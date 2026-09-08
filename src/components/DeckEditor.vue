<template>
  <div class="deck-editor">
    <div class="deck-editor-toolbar">
      <div class="deck-tabs" role="tablist" aria-label="编辑卡组分区">
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          role="tab"
          :aria-selected="activeSection === section.key"
          :class="{ active: activeSection === section.key }"
          @dragover.prevent
          @drop="dropOnSection(section.key)"
          @click="activeSection = section.key"
        >
          <span>{{ section.label }}</span>
          <strong>{{ deck[section.key]?.length || 0 }}</strong>
        </button>
      </div>
      <div class="deck-export-actions">
        <button
          type="button"
          title="打开对局实验室"
          @click="$emit('playtest')"
        >
          <Icon icon="ri:shuffle-line" />
        </button>
        <button
          type="button"
          title="生成可编辑批量草稿"
          @click="$emit('create-batch')"
        >
          <Icon icon="ri:draft-line" />
        </button>
        <button type="button" title="下载 YDK" @click="$emit('download-ydk')">
          <Icon icon="ri:download-2-line" />
        </button>
        <button type="button" title="复制 YDKe" @click="$emit('copy-ydke')">
          <Icon icon="ri:file-copy-line" />
        </button>
      </div>
    </div>

    <form class="deck-search" @submit.prevent="searchCards">
      <Icon icon="ri:search-line" />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="搜索卡片并加入当前分区"
        aria-label="搜索并添加卡片"
        @input="searchMessage = ''"
      >
      <button type="submit" :disabled="searching">
        <Icon
          :icon="searching ? 'ri:loader-4-line' : 'ri:add-line'"
          :class="{ spinning: searching }"
        />
        <span>查找</span>
      </button>
    </form>
    <div class="deck-view-options">
      <label>
        <span>排序</span>
        <select v-model="sortMode">
          <option value="custom">手动</option>
          <option value="name">名称</option>
          <option value="type">卡种</option>
          <option value="level">等级</option>
        </select>
      </label>
      <label class="auto-section">
        <input v-model="autoSection" type="checkbox">
        <span>自动分区</span>
      </label>
    </div>

    <div v-if="searchResults.length" class="deck-search-results">
      <button
        v-for="result in searchResults"
        :key="`${result.id}-${result.artid || result.altart || 0}`"
        type="button"
        @click="addSearchResult(result)"
      >
        <CardThumbnail
          :card-id="getCardArtworkId(result)"
          quality="medium"
          language="sc"
          alt=""
        />
        <span>
          <strong>{{ cardName(result) }}</strong>
          <small>{{ getCardArtworkId(result) }}</small>
        </span>
        <Icon icon="ri:add-line" />
      </button>
    </div>

    <p v-if="searchError" class="deck-message error">{{ searchError }}</p>
    <p v-else-if="searchMessage" class="deck-message">{{ searchMessage }}</p>
    <p v-else-if="actionMessage" class="deck-message">{{ actionMessage }}</p>

    <div v-if="activeCards.length" class="deck-card-grid">
      <article
        v-for="card in activeCards"
        :key="card.id"
        class="deck-card-tile"
        :class="{ dragging: draggingCard?.id === card.id }"
        draggable="true"
        @dragstart="startDrag(card.id)"
        @dragend="draggingCard = null"
        @dragover.prevent
        @drop.stop="dropBefore(card.id)"
      >
        <button
          class="deck-card-visual"
          type="button"
          :aria-label="`查看 ${cardDisplayName(card.id)}`"
          @click="selectedCardId = card.id"
        >
          <CardThumbnail
            :card-id="card.id"
            :custom-card="getCustomCard(customCards, card.id)"
            quality="medium"
            language="sc"
            :alt="cardDisplayName(card.id)"
          />
          <span class="card-count-badge">×{{ card.count }}</span>
        </button>
        <div class="deck-card-identity">
          <strong :title="cardDisplayName(card.id)">
            {{ cardDisplayName(card.id) }}
          </strong>
          <small>{{ cardDisplayNumber(card.id) }}</small>
        </div>
        <div class="card-tile-actions">
          <button
            type="button"
            :aria-label="`减少 ${card.id}`"
            title="减少一张"
            @click="setCount(card.id, card.count - 1)"
          >
            <Icon icon="ri:subtract-line" />
          </button>
          <button
            type="button"
            :aria-label="`增加 ${card.id}`"
            title="增加一张"
            @click="setCount(card.id, card.count + 1)"
          >
            <Icon icon="ri:add-line" />
          </button>
          <details class="card-more">
            <summary :aria-label="`更多操作 ${card.id}`" title="更多操作">
              <Icon icon="ri:more-2-fill" />
            </summary>
            <div class="card-action-menu">
              <button
                v-for="section in sections.filter(item => item.key !== activeSection)"
                :key="section.key"
                type="button"
                @click="moveCardFromMenu(card.id, section.key, $event)"
              >
                <Icon icon="ri:arrow-right-line" />
                <span>移至{{ section.label }}</span>
              </button>
              <button
                class="danger"
                type="button"
                @click="removeCardFromMenu(card.id, $event)"
              >
                <Icon icon="ri:delete-bin-line" />
                <span>移除卡片</span>
              </button>
            </div>
          </details>
        </div>
      </article>
    </div>
    <div v-else class="deck-empty">当前分区没有卡片</div>

    <aside v-if="selectedCard" class="card-quick-view">
      <button
        class="close-detail"
        type="button"
        title="关闭"
        @click="selectedCardId = ''"
      >
        <Icon icon="ri:close-line" />
      </button>
      <CardThumbnail
        :card-id="selectedCard.id"
        :custom-card="getCustomCard(customCards, selectedCard.id)"
        :alt="selectedCard.name"
      />
      <div>
        <strong>{{ selectedCard.name }}</strong>
        <small>{{ selectedCard.number }} · {{ selectedCard.type }}</small>
        <p>{{ selectedCard.description }}</p>
        <button
          class="edit-card-command"
          type="button"
          @click="$emit('edit-card', {
            id: selectedCard.id,
            section: activeSection,
          })"
        >
          <Icon icon="ri:edit-line" />
          <span>在单卡DIY工坊中打开</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { computed, ref, watch } from 'vue';
import CardThumbnail from '@/components/CardThumbnail.vue';
import { resolveCard, resolveSearchResult } from '@/features/cards/card-service';
import {
  customCardToResolved,
  getCustomCard,
} from '@/features/cards/custom-card';
import {
  getCardArtworkId,
  getCardDisplayName,
  searchCardDatabase,
} from '@/features/print/card-source';

const props = defineProps({
  deck: {
    type: Object,
    required: true,
  },
  actionMessage: {
    type: String,
    default: '',
  },
  customCards: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits([
  'add-card',
  'set-card-count',
  'move-card',
  'reorder-card',
  'download-ydk',
  'copy-ydke',
  'create-batch',
  'playtest',
  'edit-card',
]);

const sections = [
  { key: 'main', label: '主卡组' },
  { key: 'extra', label: '额外' },
  { key: 'side', label: '副卡组' },
];

const activeSection = ref('main');
const searchQuery = ref('');
const searchResults = ref([]);
const searchMessage = ref('');
const searchError = ref('');
const searching = ref(false);
const sortMode = ref('custom');
const autoSection = ref(true);
const draggingCard = ref(null);
const selectedCardId = ref('');
const cardNameMap = ref(new Map());
const resolvedCardMap = ref(new Map());
const queuedNameIds = new Set();
const loadingNameIds = new Set();
const nameQueue = [];
const NAME_REQUEST_LIMIT = 3;
let activeNameRequests = 0;

const activeCards = computed(() => {
  const grouped = new Map();
  (props.deck[activeSection.value] || []).forEach(id => {
    const cardId = String(id);
    grouped.set(cardId, (grouped.get(cardId) || 0) + 1);
  });
  const cards = [...grouped].map(([id, count], index) => ({
    id,
    count,
    index,
    resolved: resolvedCardMap.value.get(id),
  }));
  if (sortMode.value === 'name') {
    return cards.sort((a, b) =>
      cardDisplayName(a.id).localeCompare(cardDisplayName(b.id), 'zh-CN'));
  }
  if (sortMode.value === 'type') {
    return cards.sort((a, b) =>
      String(a.resolved?.rendererData.type || '').localeCompare(
        String(b.resolved?.rendererData.type || ''),
      ));
  }
  if (sortMode.value === 'level') {
    return cards.sort((a, b) =>
      Number(b.resolved?.rendererData.level || b.resolved?.rendererData.rank || 0) -
      Number(a.resolved?.rendererData.level || a.resolved?.rendererData.rank || 0));
  }
  return cards;
});

const allDeckCardIds = computed(() => {
  return [...new Set([
    ...(props.deck.main || []),
    ...(props.deck.extra || []),
    ...(props.deck.side || []),
  ].map(String))];
});

const cardName = card => {
  return getCardDisplayName(card) || String(card.id);
};

const cardDisplayName = cardId => {
  const customCard = getCustomCard(props.customCards, cardId);
  if (customCard) return customCard.name;
  return cardNameMap.value.get(String(cardId)) || '读取卡名…';
};

const cardDisplayNumber = cardId => {
  const customCard = getCustomCard(props.customCards, cardId);
  return customCard?.data?.password || String(cardId);
};

const selectedCard = computed(() => {
  const card = resolvedCardMap.value.get(selectedCardId.value);
  if (!card) return null;
  return {
    id: card.id,
    number: cardDisplayNumber(card.id),
    name: card.name,
    type: card.metadata.text?.types?.split('\n')[0] ||
      card.rendererData.monsterType || '卡片',
    description: card.rendererData.description || '暂无效果文本',
  };
});

const resolveCardName = async cardId => {
  const customCard = getCustomCard(props.customCards, cardId);
  if (customCard) {
    const resolved = customCardToResolved(customCard);
    resolvedCardMap.value = new Map(resolvedCardMap.value)
      .set(cardId, resolved);
    return resolved.name;
  }
  const resolved = await resolveCard(cardId);
  resolvedCardMap.value = new Map(resolvedCardMap.value).set(cardId, resolved);
  return resolved.name;
};

const drainNameQueue = () => {
  while (activeNameRequests < NAME_REQUEST_LIMIT && nameQueue.length) {
    const cardId = nameQueue.shift();
    queuedNameIds.delete(cardId);
    loadingNameIds.add(cardId);
    activeNameRequests += 1;
    resolveCardName(cardId)
      .then(name => {
        cardNameMap.value = new Map(cardNameMap.value).set(cardId, name);
      })
      .catch(() => {
        cardNameMap.value = new Map(cardNameMap.value)
          .set(cardId, '名称暂不可用');
      })
      .finally(() => {
        loadingNameIds.delete(cardId);
        activeNameRequests -= 1;
        drainNameQueue();
      });
  }
};

const queueCardName = cardId => {
  const normalizedId = String(cardId);
  const customCard = getCustomCard(props.customCards, normalizedId);
  if (customCard) {
    cardNameMap.value = new Map(cardNameMap.value)
      .set(normalizedId, customCard.name);
    resolvedCardMap.value = new Map(resolvedCardMap.value)
      .set(normalizedId, customCardToResolved(customCard));
    return;
  }
  if (
    cardNameMap.value.has(normalizedId) ||
    queuedNameIds.has(normalizedId) ||
    loadingNameIds.has(normalizedId)
  ) {
    return;
  }
  queuedNameIds.add(normalizedId);
  nameQueue.push(normalizedId);
  drainNameQueue();
};

watch(allDeckCardIds, cardIds => {
  cardIds.forEach(cardId => {
    queueCardName(cardId);
  });
}, { immediate: true });

watch(() => props.customCards, () => {
  allDeckCardIds.value.forEach(cardId => {
    queueCardName(cardId);
  });
}, { deep: true });

const searchCards = async () => {
  const query = searchQuery.value.trim();
  if (!query || searching.value) {
    searchError.value = query ? '' : '请输入卡片密码或名称';
    return;
  }
  searching.value = true;
  searchError.value = '';
  searchMessage.value = '';
  try {
    searchResults.value = (await searchCardDatabase(query)).slice(0, 6);
    const resolvedResults = await Promise.all(
      searchResults.value.map(result => resolveSearchResult(result)),
    );
    resolvedCardMap.value = new Map([
      ...resolvedCardMap.value,
      ...resolvedResults.map(card => [card.artworkId, card]),
    ]);
    if (!searchResults.value.length) {
      searchError.value = `未找到“${query}”`;
    }
  } catch (error) {
    searchResults.value = [];
    searchError.value = error instanceof Error ? error.message : String(error);
  } finally {
    searching.value = false;
  }
};

const addSearchResult = async result => {
  const id = getCardArtworkId(result);
  const name = getCardDisplayName(result);
  const resolved = await resolveSearchResult(result);
  resolvedCardMap.value = new Map(resolvedCardMap.value).set(id, resolved);
  if (name) {
    cardNameMap.value = new Map(cardNameMap.value).set(id, name);
  }
  const section = autoSection.value && activeSection.value !== 'side'
    ? resolved.defaultSection
    : activeSection.value;
  emit('add-card', {
    section,
    id,
  });
  searchMessage.value = `已加入${sections.find(item => item.key === section).label}`;
};

const setCount = (id, count) => {
  emit('set-card-count', {
    section: activeSection.value,
    id,
    count,
  });
};

const moveCard = (id, targetSection) => {
  if (targetSection === activeSection.value) {
    return;
  }
  emit('move-card', {
    sourceSection: activeSection.value,
    targetSection,
    id,
  });
};

const closeCardMenu = event => {
  event.currentTarget.closest('details')?.removeAttribute('open');
};

const moveCardFromMenu = (id, targetSection, event) => {
  closeCardMenu(event);
  moveCard(id, targetSection);
};

const removeCardFromMenu = (id, event) => {
  closeCardMenu(event);
  setCount(id, 0);
};

const startDrag = id => {
  if (sortMode.value !== 'custom') {
    sortMode.value = 'custom';
  }
  draggingCard.value = {
    id,
    sourceSection: activeSection.value,
  };
};

const dropBefore = beforeId => {
  if (!draggingCard.value) return;
  emit('reorder-card', {
    ...draggingCard.value,
    targetSection: activeSection.value,
    beforeId,
  });
  draggingCard.value = null;
};

const dropOnSection = targetSection => {
  if (!draggingCard.value) return;
  emit('reorder-card', {
    ...draggingCard.value,
    targetSection,
    beforeId: '',
  });
  activeSection.value = targetSection;
  draggingCard.value = null;
};
</script>

<style lang="scss" scoped>
.deck-editor {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.deck-editor-toolbar {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.deck-tabs {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  flex: 1;
  border: 1px solid var(--strong-line);
  border-radius: 4px;
  overflow: hidden;
}

.deck-tabs button {
  min-width: 0;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 10px;
}

.deck-tabs button + button {
  border-left: 1px solid var(--line);
}

.deck-tabs button.active {
  color: white;
  background: var(--ink);
}

.deck-tabs strong {
  font-variant-numeric: tabular-nums;
}

.deck-export-actions {
  display: flex;
  gap: 5px;
}

.deck-export-actions button {
  width: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
}

.deck-export-actions button:hover {
  border-color: var(--teal);
  color: var(--teal);
}

.deck-search {
  height: 38px;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  margin-top: 10px;
  padding-left: 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--paper);
}

.deck-search > svg {
  color: var(--teal);
}

.deck-search input {
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 11px;
}

.deck-search button {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 3px;
  padding: 0 9px;
  border: 0;
  border-radius: 3px;
  color: white;
  background: var(--teal);
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.deck-search button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.deck-search-results {
  max-height: 190px;
  overflow: auto;
  border: 1px solid var(--line);
  border-top: 0;
  background: var(--paper);
}

.deck-search-results button {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.deck-search-results button:last-child {
  border-bottom: 0;
}

.deck-search-results button:hover {
  background: #edf3f0;
}

.deck-search-results img {
  width: 30px;
  height: 43px;
  display: block;
  object-fit: cover;
  background: #e9e7e1;
}

.deck-search-results :deep(.card-thumbnail-state) {
  width: 30px;
  height: 43px;
}

.deck-search-results span {
  min-width: 0;
}

.deck-search-results strong,
.deck-search-results small {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.deck-search-results strong {
  font-size: 11px;
}

.deck-search-results small {
  margin-top: 3px;
  color: var(--muted);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 9px;
}

.deck-view-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  color: var(--muted);
  font-size: 10px;
}

.deck-view-options label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.deck-view-options select {
  height: 28px;
  padding: 0 24px 0 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: var(--paper);
  font-size: 10px;
}

.auto-section input {
  accent-color: var(--teal);
}

.deck-message {
  margin: 8px 0 0;
  color: var(--teal);
  font-size: 10px;
}

.deck-message.error {
  color: var(--accent);
}

.deck-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  align-items: start;
  gap: 16px 10px;
  margin-top: 12px;
}

.deck-card-tile {
  min-width: 0;
  transition: opacity 140ms ease;
}

.deck-card-tile.dragging {
  opacity: 0.35;
}

.deck-card-visual {
  width: 100%;
  padding: 0;
  position: relative;
  overflow: hidden;
  aspect-ratio: 59 / 86;
  border: 1px solid var(--strong-line);
  border-radius: 0;
  background: #e9e7e1;
  cursor: pointer;
}

.deck-card-visual img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
}

.deck-card-visual > :deep(.card-thumbnail-state) {
  width: 100%;
  height: 100%;
}

.card-count-badge {
  min-width: 20px;
  height: 18px;
  position: absolute;
  top: 3px;
  right: 3px;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 3px;
  color: white;
  background: rgba(20, 20, 18, 0.88);
  font-size: 9px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.deck-card-identity {
  min-width: 0;
  margin-top: 5px;
}

.deck-card-identity strong {
  min-height: 25px;
  display: -webkit-box;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.deck-card-identity small {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--muted);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 7px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.card-tile-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
}

.card-tile-actions > button,
.card-more > summary {
  min-width: 0;
  height: 32px;
  display: grid;
  place-items: center;
  position: relative;
  border: 0;
  border-right: 1px solid var(--line);
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
}

.card-more > summary {
  border-right: 0;
  list-style: none;
}

.card-more > summary::-webkit-details-marker {
  display: none;
}

.card-tile-actions > button:hover,
.card-more > summary:hover,
.card-more[open] > summary {
  color: var(--teal);
  background: #edf3f0;
}

.card-tile-actions > button svg,
.card-more > summary svg {
  font-size: 16px;
}

.card-more {
  min-width: 0;
  position: relative;
}

.card-action-menu {
  width: 122px;
  position: absolute;
  z-index: 20;
  top: calc(100% + 5px);
  right: -1px;
  padding: 4px;
  border: 1px solid var(--strong-line);
  border-radius: 4px;
  background: var(--paper);
  box-shadow: 0 8px 24px rgba(43, 39, 30, 0.18);
}

.card-action-menu button {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border: 0;
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  font-size: 10px;
  text-align: left;
  white-space: nowrap;
}

.card-action-menu button:hover {
  color: var(--teal);
  background: #edf3f0;
}

.card-action-menu button.danger {
  margin-top: 3px;
  border-top: 1px solid var(--line);
  color: var(--accent);
}

.deck-empty {
  min-height: 86px;
  display: grid;
  place-items: center;
  margin-top: 10px;
  border: 1px dashed var(--line);
  color: var(--muted);
  font-size: 10px;
}

.card-quick-view {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 12px;
  position: relative;
  margin-top: 16px;
  padding: 12px;
  border-top: 1px solid var(--strong-line);
  border-bottom: 1px solid var(--line);
  background: #f0eee8;
}

.card-quick-view > img {
  width: 82px;
  aspect-ratio: 59 / 86;
  object-fit: fill;
  background: #e9e7e1;
}

.card-quick-view > div {
  min-width: 0;
  padding-right: 24px;
}

.card-quick-view strong,
.card-quick-view small {
  display: block;
}

.card-quick-view strong {
  padding-right: 16px;
  font-size: 12px;
}

.card-quick-view small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 9px;
}

.card-quick-view p {
  max-height: 66px;
  margin: 8px 0;
  overflow: auto;
  font-size: 9px;
  line-height: 1.5;
}

.edit-card-command {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  color: var(--teal);
  background: transparent;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.close-detail {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  position: absolute;
  top: 8px;
  right: 8px;
  border: 0;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.spinning {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
