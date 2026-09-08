<template>
  <div class="library-app">
    <header class="library-header">
      <a class="library-brand" href="../">
        <span>YG</span>
        <strong>卡片资料库</strong>
      </a>
      <nav aria-label="工作台导航">
        <a href="../editor/">单卡DIY工坊</a>
        <a href="../print/">卡组打印工作台</a>
        <a href="../batch/">批量制卡</a>
      </nav>
    </header>

    <main>
      <section class="library-tools">
        <div>
          <span class="eyebrow">CARD ARCHIVE</span>
          <h1>查找卡片与版本</h1>
        </div>
        <form @submit.prevent="runSearch">
          <Icon icon="ri:search-line" />
          <input
            v-model="query"
            type="search"
            aria-label="搜索卡片资料库"
            placeholder="输入卡名或密码"
            autofocus
          >
          <button type="submit" :disabled="searching">
            {{ searching ? '检索中' : '检索' }}
          </button>
        </form>
        <div class="filter-tabs" role="tablist" aria-label="卡片类型">
          <button
            v-for="filter in filters"
            :key="filter.key"
            type="button"
            :class="{ active: activeFilter === filter.key }"
            @click="activeFilter = filter.key"
          >
            {{ filter.label }}
          </button>
        </div>
      </section>

      <section class="library-content">
        <div class="result-header">
          <p>{{ resultLabel }}</p>
          <span v-if="activeProject">加入：{{ activeProject.name }}</span>
        </div>

        <div v-if="visibleResults.length" class="card-catalog">
          <article
            v-for="card in visibleResults"
            :key="`${card.id}-${card.artworkId}`"
            :class="{ selected: selected?.artworkId === card.artworkId }"
          >
            <button class="catalog-image" type="button" @click="selected = card">
              <CardThumbnail
                :card-id="card.artworkId"
                quality="medium"
                language="sc"
                :alt="card.name"
              />
              <span v-if="card.prerelease" class="catalog-badge">先行</span>
              <span
                v-else-if="card.alternateArtwork"
                class="catalog-badge"
              >
                异画
              </span>
            </button>
            <strong>{{ card.name }}</strong>
            <small>{{ card.artworkId }}</small>
            <div class="catalog-actions">
              <button type="button" title="加入当前卡组" @click="addToProject(card)">
                <Icon icon="ri:add-line" />
              </button>
              <a :href="`../editor/?card=${card.artworkId}`" title="在单卡DIY工坊中打开">
                <Icon icon="ri:edit-line" />
              </a>
            </div>
          </article>
        </div>

        <div v-else class="library-empty">
          <Icon icon="ri:archive-drawer-line" />
          <p>{{ errorMessage || '搜索卡名或密码开始浏览' }}</p>
        </div>

        <aside v-if="selected" class="catalog-detail">
          <button type="button" title="关闭详情" @click="selected = null">
            <Icon icon="ri:close-line" />
          </button>
          <CardThumbnail
            :card-id="selected.artworkId"
            :alt="selected.name"
          />
          <div>
            <span class="eyebrow">{{ selected.source }}</span>
            <h2>{{ selected.name }}</h2>
            <p class="catalog-meta">
              {{ selected.artworkId }} · {{ selected.type }}
            </p>
            <p class="catalog-description">{{ selected.description || '暂无效果文本' }}</p>
            <div class="detail-actions">
              <button type="button" @click="addToProject(selected)">
                <Icon icon="ri:add-line" />
                <span>加入卡组</span>
              </button>
              <button type="button" @click="addToBatch(selected)">
                <Icon icon="ri:draft-line" />
                <span>生成草稿</span>
              </button>
              <a :href="`../editor/?card=${selected.artworkId}`">
                <Icon icon="ri:edit-line" />
                <span>编辑卡面</span>
              </a>
            </div>
          </div>
        </aside>
      </section>
    </main>

    <p v-if="notice" class="library-notice">{{ notice }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import CardThumbnail from '@/components/CardThumbnail.vue';
import {
  appendBatchCards,
  resolvedCardToBatchCard,
} from '@/features/batch/batch-project';
import { resolveCard, resolveSearchResult } from '@/features/cards/card-service';
import { searchCardDatabase } from '@/features/print/card-source';
import {
  getActiveProjectId,
  getProject,
  saveProject,
  setActiveProjectId,
} from '@/features/projects/project-store';

const filters = [
  { key: 'all', label: '全部' },
  { key: 'monster', label: '怪兽' },
  { key: 'spell', label: '魔法' },
  { key: 'trap', label: '陷阱' },
  { key: 'prerelease', label: '先行' },
];

const query = ref('');
const searching = ref(false);
const activeFilter = ref('all');
const results = ref([]);
const selected = ref(null);
const errorMessage = ref('');
const notice = ref('');
const activeProject = ref(null);

const visibleResults = computed(() => {
  if (activeFilter.value === 'all') return results.value;
  if (activeFilter.value === 'prerelease') {
    return results.value.filter(card => card.prerelease);
  }
  return results.value.filter(card => card.rendererType === activeFilter.value);
});

const resultLabel = computed(() => {
  if (!results.value.length) return '等待检索';
  return `${visibleResults.value.length} 个匹配版本`;
});

const runSearch = async () => {
  const keyword = query.value.trim();
  if (!keyword || searching.value) return;
  searching.value = true;
  errorMessage.value = '';
  selected.value = null;
  try {
    const matches = (await searchCardDatabase(keyword)).slice(0, 40);
    results.value = await Promise.all(matches.map(async result => {
      const resolved = await resolveSearchResult(result);
      return {
        ...resolved,
        type: result.text?.types?.split('\n')[0] ||
          resolved.rendererData.monsterType || '卡片',
        description: resolved.rendererData.description,
        rendererType: resolved.rendererData.type,
      };
    }));
    if (!results.value.length) {
      errorMessage.value = `未找到“${keyword}”`;
    }
  } catch (error) {
    results.value = [];
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    searching.value = false;
  }
};

const addToProject = async card => {
  let project = activeProject.value;
  if (!project) {
    project = {
      kind: 'deck',
      name: '我的卡组',
      deck: { main: [], extra: [], side: [] },
      settings: {},
      selectedSections: { main: true, extra: true, side: true },
    };
  }
  const section = card.defaultSection;
  project = {
    ...project,
    deck: {
      ...project.deck,
      [section]: [...(project.deck[section] || []), card.artworkId],
    },
  };
  activeProject.value = await saveProject(project);
  setActiveProjectId(activeProject.value.id);
  notice.value = `${card.name} 已加入${section === 'extra' ? '额外卡组' : '主卡组'}`;
  setTimeout(() => {
    notice.value = '';
  }, 1800);
};

const addToBatch = async card => {
  try {
    const activeId = getActiveProjectId('batch');
    let project = activeId ? await getProject(activeId) : null;
    if (project?.kind !== 'batch') {
      project = {
        kind: 'batch',
        name: '资料库草稿',
        cards: [],
      };
    }
    const resolved = await resolveCard(card.artworkId);
    const saved = await saveProject(appendBatchCards(
      project,
      [resolvedCardToBatchCard(resolved)],
    ));
    setActiveProjectId(saved.id, 'batch');
    notice.value = `${card.name} 已加入“${saved.name}”`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
};

onMounted(async () => {
  const projectId = getActiveProjectId();
  if (projectId) {
    const project = await getProject(projectId);
    if ((project?.kind || 'deck') === 'deck') {
      activeProject.value = project;
    }
  }
  const initialQuery = new URLSearchParams(location.search).get('q');
  if (initialQuery) {
    query.value = initialQuery;
    runSearch();
  }
});
</script>

<style lang="scss" scoped>
.library-app {
  --paper: #fffefa;
  --canvas: #f3f1ec;
  --ink: #1c1d1b;
  --muted: #74736e;
  --line: #d8d5ce;
  --strong-line: #aaa69d;
  --accent: #b94532;
  --teal: #285e58;
  min-height: 100vh;
  color: var(--ink);
  background: var(--canvas);
}

.library-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  border-bottom: 1px solid var(--line);
}

.library-brand,
.library-header nav,
.library-header nav a {
  display: flex;
  align-items: center;
}

.library-brand {
  gap: 11px;
  color: var(--ink);
  text-decoration: none;
}

.library-brand > span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  font-size: 11px;
  font-weight: 800;
}

.library-brand strong {
  font-family: "Songti SC", "STSong", serif;
  font-size: 18px;
}

.library-header nav {
  gap: 24px;
}

.library-header nav a {
  height: 64px;
  color: var(--muted);
  font-size: 12px;
  text-decoration: none;
}

.library-header nav a:hover {
  color: var(--teal);
}

.library-tools {
  display: grid;
  grid-template-columns: minmax(190px, 0.7fr) minmax(280px, 1.2fr) auto;
  align-items: end;
  gap: 28px;
  padding: 34px 4vw 26px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.library-tools h1 {
  margin: 5px 0 0;
  font-family: "Songti SC", "STSong", serif;
  font-size: 27px;
}

.library-tools form {
  height: 44px;
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  padding-left: 12px;
  border: 1px solid var(--strong-line);
  background: var(--paper);
}

.library-tools form svg {
  color: var(--teal);
}

.library-tools input {
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
}

.library-tools form button {
  height: 36px;
  margin-right: 3px;
  padding: 0 18px;
  border: 0;
  color: white;
  background: var(--ink);
  cursor: pointer;
}

.filter-tabs {
  display: flex;
  border-bottom: 1px solid var(--strong-line);
}

.filter-tabs button {
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
}

.filter-tabs button.active {
  border-bottom-color: var(--accent);
  color: var(--ink);
  font-weight: 700;
}

.library-content {
  padding: 22px 4vw 56px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 11px;
}

.card-catalog {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 26px 16px;
  margin-top: 18px;
}

.card-catalog article {
  min-width: 0;
}

.catalog-image {
  width: 100%;
  display: block;
  position: relative;
  padding: 0;
  overflow: hidden;
  aspect-ratio: 59 / 86;
  border: 1px solid var(--strong-line);
  border-radius: 2px;
  background: #e8e5de;
  cursor: pointer;
}

.catalog-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
}

.catalog-image > :deep(.card-thumbnail-state) {
  width: 100%;
  height: 100%;
}

.catalog-image > .catalog-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  padding: 3px 5px;
  color: white;
  background: rgba(28, 29, 27, 0.88);
  font-size: 8px;
  font-weight: 800;
}

.card-catalog article > strong,
.card-catalog article > small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-catalog article > strong {
  margin-top: 7px;
  font-size: 11px;
  white-space: nowrap;
}

.card-catalog article > small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 8px;
}

.catalog-actions {
  display: flex;
  margin-top: 7px;
  border: 1px solid var(--line);
}

.catalog-actions button,
.catalog-actions a {
  width: 50%;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  text-decoration: none;
}

.catalog-actions > :first-child {
  border-right: 1px solid var(--line);
}

.catalog-actions button:hover,
.catalog-actions a:hover {
  color: var(--teal);
}

.library-empty {
  min-height: 360px;
  display: grid;
  place-content: center;
  justify-items: center;
  color: var(--muted);
}

.library-empty svg {
  font-size: 30px;
}

.catalog-detail {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 24px;
  position: fixed;
  z-index: 30;
  right: 24px;
  bottom: 24px;
  width: min(620px, calc(100vw - 48px));
  padding: 18px;
  border: 1px solid var(--strong-line);
  background: var(--paper);
  box-shadow: 0 16px 46px rgba(30, 27, 20, 0.2);
}

.catalog-detail > img {
  width: 190px;
  aspect-ratio: 59 / 86;
  object-fit: fill;
}

.catalog-detail > button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  position: absolute;
  top: 8px;
  right: 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.catalog-detail h2 {
  margin: 6px 38px 0 0;
  font-family: "Songti SC", "STSong", serif;
  font-size: 24px;
}

.catalog-meta {
  color: var(--muted);
  font-size: 10px;
}

.catalog-description {
  max-height: 150px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.65;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.detail-actions button,
.detail-actions a {
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--ink);
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  text-decoration: none;
}

.library-notice {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
  margin: 0;
  padding: 10px 14px;
  color: white;
  background: var(--teal);
  font-size: 11px;
}

@media (max-width: 760px) {
  .library-header {
    padding: 0 18px;
  }

  .library-header nav {
    gap: 12px;
  }

  .library-header nav a:first-child {
    display: none;
  }

  .library-tools {
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 16px;
    padding: 24px 18px 18px;
  }

  .library-content {
    padding: 18px;
  }

  .card-catalog {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px 9px;
  }

  .catalog-detail {
    grid-template-columns: 100px minmax(0, 1fr);
    right: 10px;
    bottom: 10px;
    width: calc(100vw - 20px);
    padding: 12px;
  }

  .catalog-detail > img {
    width: 100px;
  }

  .catalog-detail h2 {
    font-size: 17px;
  }

  .catalog-description {
    max-height: 92px;
    font-size: 10px;
  }
}
</style>
