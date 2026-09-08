<template>
  <div class="workspace-launcher">
    <header class="launcher-header">
      <a class="launcher-brand" href="./" aria-label="Better YGO">
        <span>BY</span>
        <strong>Better YGO</strong>
      </a>
      <div class="launcher-status">
        <span>{{ decks.length }} 套本地卡组</span>
        <a
          class="github-star"
          href="https://github.com/ASTion24/better-yugioh-card"
          target="_blank"
          rel="noreferrer"
          title="在 GitHub 上 Star"
          aria-label="在 GitHub 上 Star Better YGO"
        >
          <Icon :icon="starLine" />
          <span>Star</span>
        </a>
      </div>
    </header>

    <main>
      <section
        class="launch-console"
        :class="{ dragging: isQuickDragging }"
        @dragover.prevent="isQuickDragging = true"
        @dragleave.prevent="isQuickDragging = false"
        @drop.prevent="onQuickDrop"
      >
        <img
          class="launch-art"
          :src="accesscodeTalkerHero"
          alt="访问码语者卡片原画"
        >
        <div class="launch-copy">
          <header class="launch-heading">
            <div>
              <span>卡片与构筑工具</span>
              <h1>Better YGO</h1>
            </div>
          </header>
          <div class="quick-actions">
            <button
              class="quick-file-command"
              type="button"
              :disabled="quickBusy"
              @click="quickFileInput?.click()"
            >
              <Icon :icon="uploadCloud2Line" />
              <span>
                <strong>{{ quickBusy ? '正在导入卡组' : '打开图片或文件以导入卡组' }}</strong>
                <small>卡组截图、YDK 或卡组备份</small>
              </span>
              <Icon :icon="arrowRightLine" />
            </button>
            <input
              ref="quickFileInput"
              class="visually-hidden"
              type="file"
              accept=".ydk,.txt,.ygoproject,.ygoworkspace,.json,image/png,image/jpeg,image/webp"
              @change="onQuickFileChange"
            >
            <div class="quick-text-command">
              <Icon :icon="linkM" />
              <textarea
                v-model="quickText"
                rows="1"
                aria-label="粘贴 YDK、YDKe 或卡组链接以导入卡组"
                placeholder="粘贴 YDK、YDKe 或卡组链接以导入卡组"
                @keydown.meta.enter.prevent="importQuickText"
                @keydown.ctrl.enter.prevent="importQuickText"
              />
              <button
                type="button"
                title="解析并打开卡组"
                :disabled="quickBusy || !quickText.trim()"
                @click="importQuickText"
              >
                <Icon :icon="arrowRightLine" />
              </button>
            </div>
          </div>
          <p
            v-if="quickStatus"
            class="quick-status"
            :class="{ error: quickError }"
          >
            <Icon
              :icon="quickError
                ? errorWarningLine
                : checkboxCircleLine"
            />
            <span>{{ quickStatus }}</span>
          </p>
        </div>
      </section>

      <nav class="workspace-commands" aria-label="选择工作区">
        <a
          v-for="workspace in workspaces"
          :key="workspace.key"
          :href="workspace.href"
        >
          <Icon :icon="workspace.icon" />
          <span class="command-name">
            <strong>{{ workspace.name }}</strong>
          </span>
        </a>
      </nav>

      <DeckImageImporter
        ref="imageImporter"
        triggerless
        import-label="导入卡组并编辑"
        @import="openRecognizedDeck"
        @notice="workspaceNotice = $event"
      />

      <section class="recent-projects" aria-label="最近卡组">
        <div class="recent-heading">
          <h2>最近卡组</h2>
          <div class="recent-tools">
            <label v-if="decks.length" class="project-search">
              <Icon :icon="searchLine" />
              <input
                v-model="deckQuery"
                type="search"
                aria-label="搜索本地卡组"
                placeholder="搜索卡组"
              >
            </label>
            <button
              type="button"
              title="备份全部卡组"
              :disabled="!decks.length"
              @click="backupWorkspace"
            >
              <Icon :icon="archiveLine" />
            </button>
            <button
              type="button"
              title="恢复卡组备份"
              @click="backupFileInput?.click()"
            >
              <Icon :icon="folderOpenLine" />
            </button>
            <input
              ref="backupFileInput"
              class="visually-hidden"
              type="file"
              accept=".ygoworkspace,.json,application/json"
              @change="restoreWorkspaceFile"
            >
          </div>
        </div>

        <template v-if="filteredDecks.length">
          <div class="project-list">
            <button
              v-for="deck in visibleDecks"
              :key="deck.id"
              type="button"
              :aria-label="`编辑卡组 ${deck.name}`"
              @click="openDeck(deck)"
            >
              <Icon :icon="layoutGridLine" />
              <span>
                <strong>{{ deck.name }}</strong>
                <small>{{ deckSummary(deck) }}</small>
              </span>
              <Icon :icon="arrowRightUpLine" />
            </button>
          </div>
          <button
            v-if="filteredDecks.length > 6 && !deckQuery"
            class="project-list-toggle"
            type="button"
            @click="showAllDecks = !showAllDecks"
          >
            <Icon :icon="showAllDecks ? arrowUpSLine : arrowDownSLine" />
            <span>{{ showAllDecks ? '收起卡组' : `查看全部 ${filteredDecks.length} 套卡组` }}</span>
          </button>
        </template>
        <div v-else class="empty-projects">
          <Icon :icon="archiveStackLine" />
          <span>{{ loadError || (deckQuery ? '没有匹配卡组' : '暂无本地卡组') }}</span>
        </div>
      </section>
    </main>

    <p v-if="workspaceNotice" class="workspace-notice">{{ workspaceNotice }}</p>

    <footer>
      <span>BETTER YGO</span>
      <span>LOCAL DECKS · 2026</span>
    </footer>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import archiveDrawerLine from '@iconify-icons/ri/archive-drawer-line';
import archiveLine from '@iconify-icons/ri/archive-line';
import archiveStackLine from '@iconify-icons/ri/archive-stack-line';
import arrowDownSLine from '@iconify-icons/ri/arrow-down-s-line';
import arrowRightLine from '@iconify-icons/ri/arrow-right-line';
import arrowRightUpLine from '@iconify-icons/ri/arrow-right-up-line';
import arrowUpSLine from '@iconify-icons/ri/arrow-up-s-line';
import checkboxCircleLine from '@iconify-icons/ri/checkbox-circle-line';
import errorWarningLine from '@iconify-icons/ri/error-warning-line';
import folderOpenLine from '@iconify-icons/ri/folder-open-line';
import idCardLine from '@iconify-icons/ri/id-card-line';
import imageCircleAiLine from '@iconify-icons/ri/image-circle-ai-line';
import layoutGridLine from '@iconify-icons/ri/layout-grid-line';
import linkM from '@iconify-icons/ri/link-m';
import searchLine from '@iconify-icons/ri/search-line';
import shuffleLine from '@iconify-icons/ri/shuffle-line';
import stackLine from '@iconify-icons/ri/stack-line';
import starLine from '@iconify-icons/ri/star-line';
import uploadCloud2Line from '@iconify-icons/ri/upload-cloud-2-line';
import { computed, onMounted, ref } from 'vue';
import accesscodeTalkerHero from '@/assets/image/accesscode-talker.jpg';
import DeckImageImporter from '@/components/DeckImageImporter.vue';
import { resolveDeckInput } from '@/features/decks/remote-deck.js';
import {
  listProjects,
  parseProject,
  restoreWorkspace,
  saveProject,
  serializeWorkspace,
  setActiveProjectId,
} from '@/features/projects/project-store';

const workspaces = [
  {
    key: 'card',
    name: '单卡DIY工坊',
    href: './editor/',
    icon: idCardLine,
  },
  {
    key: 'deck',
    name: '卡组打印工作台',
    href: './print/',
    icon: layoutGridLine,
  },
  {
    key: 'recognize',
    name: '图像识别',
    href: './recognize/',
    icon: imageCircleAiLine,
  },
  {
    key: 'library',
    name: '卡片资料库',
    href: './library/',
    icon: archiveDrawerLine,
  },
  {
    key: 'playtest',
    name: '对局实验室',
    href: './playtest/',
    icon: shuffleLine,
  },
  {
    key: 'batch',
    name: '批量制卡',
    href: './batch/',
    icon: stackLine,
  },
];

const decks = ref([]);
const loadError = ref('');
const deckQuery = ref('');
const showAllDecks = ref(false);
const backupFileInput = ref(null);
const imageImporter = ref(null);
const isQuickDragging = ref(false);
const quickBusy = ref(false);
const quickError = ref(false);
const quickFileInput = ref(null);
const quickStatus = ref('');
const quickText = ref('');
const workspaceNotice = ref('');

const filteredDecks = computed(() => {
  const query = deckQuery.value.trim().toLocaleLowerCase();
  if (!query) return decks.value;
  return decks.value.filter(deck => {
    const analysisMeta = deck.playtest?.analysis?.metadata || {};
    return [
      deck.name,
      analysisMeta.format,
      analysisMeta.event,
      ...(analysisMeta.tags || []),
    ].join(' ')
      .toLocaleLowerCase()
      .includes(query);
  });
});

const visibleDecks = computed(() => {
  if (deckQuery.value.trim() || showAllDecks.value) {
    return filteredDecks.value;
  }
  return filteredDecks.value.slice(0, 6);
});

const openSavedDeck = deck => {
  setActiveProjectId(deck.id, 'deck');
  location.href = './print/';
};

const saveImportedDeck = async (deck, fallbackName = '') => {
  const normalizedDeck = {
    main: [...(deck?.main || [])].map(String),
    extra: [...(deck?.extra || [])].map(String),
    side: [...(deck?.side || [])].map(String),
  };
  const total = Object.values(normalizedDeck)
    .reduce((sum, section) => sum + section.length, 0);
  if (!total) throw new Error('没有找到可导入的卡片');
  const saved = await saveProject({
    kind: 'deck',
    name: String(deck?.name || fallbackName || '导入卡组').trim(),
    deck: normalizedDeck,
    customCards: {},
    selectedSections: {
      main: true,
      extra: true,
      side: true,
    },
  });
  openSavedDeck(saved);
};

const importProjectText = async value => {
  const imported = parseProject(value);
  if (imported.kind !== 'deck') {
    throw new Error('请选择卡组备份文件');
  }
  openSavedDeck(await saveProject(imported));
};

const handleQuickFile = async file => {
  if (!file || quickBusy.value) return;
  quickBusy.value = true;
  quickError.value = false;
  quickStatus.value = '';
  try {
    const lowerName = file.name.toLowerCase();
    if (file.type.startsWith('image/') ||
      /\.(?:png|jpe?g|webp)$/.test(lowerName)) {
      await imageImporter.value?.openFile(file);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('文件不能超过 10 MB');
    }
    const value = await file.text();
    if (lowerName.endsWith('.ygoworkspace')) {
      const restored = await restoreWorkspace(value, { kind: 'deck' });
      await refreshDecks();
      quickStatus.value = `已恢复 ${restored.length} 套卡组`;
      return;
    }
    if (lowerName.endsWith('.ygoproject')) {
      await importProjectText(value);
      return;
    }
    if (lowerName.endsWith('.json')) {
      const format = JSON.parse(value)?.format;
      if (format === 'yugioh-card-workspace') {
        const restored = await restoreWorkspace(value, { kind: 'deck' });
        await refreshDecks();
        quickStatus.value = `已恢复 ${restored.length} 套卡组`;
        return;
      }
      if (format === 'yugioh-card-project') {
        await importProjectText(value);
        return;
      }
      throw new Error('JSON 不是可识别的卡组或工作区备份');
    }
    await saveImportedDeck(
      await resolveDeckInput(value),
      file.name.replace(/\.[^.]+$/, ''),
    );
  } catch (error) {
    quickError.value = true;
    quickStatus.value = error instanceof Error
      ? error.message
      : String(error);
  } finally {
    quickBusy.value = false;
  }
};

const onQuickFileChange = event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  handleQuickFile(file);
};

const onQuickDrop = event => {
  isQuickDragging.value = false;
  handleQuickFile(event.dataTransfer?.files?.[0]);
};

const importQuickText = async () => {
  const value = quickText.value.trim();
  if (!value || quickBusy.value) return;
  quickBusy.value = true;
  quickError.value = false;
  quickStatus.value = '正在解析卡组';
  try {
    await saveImportedDeck(await resolveDeckInput(value));
  } catch (error) {
    quickError.value = true;
    quickStatus.value = error instanceof Error
      ? error.message
      : String(error);
  } finally {
    quickBusy.value = false;
  }
};

const openRecognizedDeck = async payload => {
  try {
    await saveImportedDeck(payload?.deck, payload?.name);
  } catch (error) {
    workspaceNotice.value = error instanceof Error
      ? error.message
      : String(error);
  }
};

const deckSummary = deck => {
  const analysisMeta = deck.playtest?.analysis?.metadata || {};
  const sections = [
    `${deck.deck?.main?.length || 0} 主`,
    `${deck.deck?.extra?.length || 0} 额外`,
    `${deck.deck?.side?.length || 0} 副卡组`,
  ];
  const details = [
    ...sections,
    analysisMeta.event,
    ...(analysisMeta.tags || []).slice(0, 2),
    formatUpdatedAt(deck.updatedAt),
  ].filter(Boolean);
  return details.join(' · ');
};

const formatUpdatedAt = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未保存';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const openDeck = deck => {
  openSavedDeck(deck);
};

const refreshDecks = async () => {
  decks.value = await listProjects('deck');
};

const downloadText = (content, filename) => {
  const blob = new Blob([content], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const backupWorkspace = () => {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    serializeWorkspace(decks.value),
    `better-ygo-decks-${date}.ygoworkspace`,
  );
  workspaceNotice.value = `已备份 ${decks.value.length} 套卡组`;
};

const restoreWorkspaceFile = async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  loadError.value = '';
  try {
    const restored = await restoreWorkspace(await file.text(), {
      kind: 'deck',
    });
    await refreshDecks();
    workspaceNotice.value = `已恢复 ${restored.length} 套卡组`;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
    workspaceNotice.value = '';
  }
};

onMounted(async () => {
  try {
    await refreshDecks();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
  }
});
</script>

<style lang="scss" scoped>
.workspace-launcher {
  --paper: #ffffff;
  --canvas: #f4f5f7;
  --ink: #202124;
  --muted: #6f737b;
  --line: #dfe1e5;
  --accent: #b63d32;
  --moss: #2f665c;
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  grid-template-rows: 60px 1fr 36px;
  overflow-x: hidden;
  font-family: "Avenir Next", "SF Pro Text", "PingFang SC",
    "Hiragino Sans GB", sans-serif;
  font-size: 14px;
  letter-spacing: 0;
  color: var(--ink);
  background: var(--canvas);
}

.launcher-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(20px, 3vw, 42px);
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  background: var(--paper);
}

.launcher-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  color: inherit;
  text-decoration: none;
}

.launcher-brand > span {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  color: white;
  background: var(--ink);
  font-size: 10px;
  font-weight: 800;
}

.launcher-brand strong {
  font-size: 15px;
  font-weight: 650;
}

.launcher-status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}

.github-star {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--ink);
  background: var(--paper);
  font-weight: 650;
  text-decoration: none;
  transition: border-color 160ms ease, color 160ms ease,
    background-color 160ms ease;
}

.github-star:hover {
  border-color: var(--ink);
  color: white;
  background: var(--ink);
}

.github-star svg {
  font-size: 16px;
}

main {
  width: min(1240px, 100%);
  margin: 0 auto;
  padding: 16px 24px 48px;
}

.launch-console {
  position: relative;
  min-height: 342px;
  isolation: isolate;
  overflow: hidden;
  color: white;
  background: #15181c;
  transition: box-shadow 160ms ease;
}

.launch-console.dragging {
  box-shadow: inset 0 0 0 3px var(--accent);
}

.launch-console::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  width: 4px;
  content: "";
  background: var(--accent);
}

.launch-art {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: 52%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 27%;
  clip-path: polygon(12% 0, 100% 0, 100% 100%, 0 100%);
  opacity: 0.86;
  filter: saturate(0.82) brightness(0.78) contrast(1.08);
  pointer-events: none;
  animation: art-arrive 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.launch-copy {
  position: relative;
  z-index: 2;
  width: 60%;
  min-width: 0;
  padding: 42px 44px 40px;
  animation: copy-arrive 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.launch-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.launch-heading > div > span {
  display: block;
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
  font-weight: 600;
}

.launch-heading h1 {
  margin: 0;
  font-size: 38px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0;
}

.quick-actions {
  width: min(650px, 100%);
  display: grid;
  grid-template-columns: minmax(220px, 0.84fr) minmax(280px, 1.16fr);
  gap: 10px;
  margin-top: 32px;
}

.quick-file-command {
  width: 100%;
  min-height: 60px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border: 0;
  border-radius: 6px;
  color: white;
  background: var(--accent);
  cursor: pointer;
  text-align: left;
  transition: background-color 160ms ease, transform 160ms ease;
}

.quick-file-command:hover:not(:disabled) {
  background: #c94c40;
  transform: translateY(-1px);
}

.quick-file-command:disabled,
.quick-text-command button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.quick-file-command > svg:first-child {
  width: 20px;
  height: 20px;
  padding: 0;
  color: white;
  background: transparent;
  font-size: 20px;
}

.quick-file-command > svg:last-child {
  justify-self: end;
  color: rgba(255, 255, 255, 0.72);
  font-size: 17px;
}

.quick-file-command strong,
.quick-file-command small {
  display: block;
}

.quick-file-command strong {
  font-size: 14px;
  font-weight: 650;
}

.quick-file-command small {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.66);
  font-size: 9px;
}

.quick-text-command {
  width: 100%;
  min-height: 60px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 42px;
  align-items: stretch;
  margin-top: 0;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 6px;
  background: rgba(10, 12, 15, 0.6);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.quick-text-command:focus-within {
  border-color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
}

.quick-text-command > svg {
  align-self: center;
  justify-self: center;
  color: rgba(255, 255, 255, 0.62);
}

.quick-text-command textarea {
  min-width: 0;
  height: 58px;
  padding: 18px 8px;
  resize: none;
  overflow: hidden;
  border: 0;
  outline: 0;
  color: white;
  background: transparent;
  font: inherit;
  font-size: 11px;
  line-height: 20px;
}

.quick-text-command textarea::placeholder {
  color: rgba(255, 255, 255, 0.58);
}

.quick-text-command button {
  border: 0;
  border-radius: 0;
  color: white;
  background: transparent;
  cursor: pointer;
  font-size: 17px;
  transition: color 160ms ease, transform 160ms ease;
}

.quick-text-command button:hover:not(:disabled) {
  color: white;
  transform: translateX(2px);
}

.quick-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 11px 0 0;
  color: white;
  font-size: 10px;
}

.quick-status.error {
  color: var(--accent);
}

.workspace-commands {
  min-height: 62px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-top: 14px;
  border-bottom: 1px solid var(--line);
  background: transparent;
}

.workspace-commands a {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 10px 8px;
  overflow: hidden;
  color: var(--ink);
  text-decoration: none;
  animation: command-arrive 500ms ease both;
  transition: color 160ms ease, transform 160ms ease;
}

.workspace-commands a:nth-child(2) {
  animation-delay: 40ms;
}

.workspace-commands a:nth-child(3) {
  animation-delay: 80ms;
}

.workspace-commands a:nth-child(4) {
  animation-delay: 120ms;
}

.workspace-commands a:nth-child(5) {
  animation-delay: 160ms;
}

.workspace-commands a:nth-child(6) {
  animation-delay: 200ms;
}

.workspace-commands a + a {
  border-left: 0;
}

.workspace-commands a:hover {
  color: var(--accent);
  background: transparent;
  transform: translateY(-2px);
}

.workspace-commands a > svg {
  grid-column: 1;
  grid-row: 1;
  width: 18px;
  height: 18px;
  padding: 7px;
  box-sizing: content-box;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--moss);
  background: var(--paper);
  font-size: 18px;
  transition: border-color 160ms ease, color 160ms ease;
}

.workspace-commands a:hover > svg {
  border-color: rgba(182, 61, 50, 0.34);
  color: var(--accent);
}

.command-index {
  display: none;
}

.workspace-commands a:hover .command-index {
  color: inherit;
}

.command-name {
  min-width: 0;
}

.command-name strong,
.command-name small {
  display: block;
}

.command-name strong {
  font-size: 12px;
  font-weight: 650;
}

.recent-projects {
  min-width: 0;
  margin-top: 32px;
  padding-left: 0;
  border-left: 0;
}

.recent-heading {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.recent-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}

.recent-tools {
  display: flex;
  align-items: center;
  gap: 5px;
}

.recent-tools > span {
  display: none;
}

.recent-tools > button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  font-size: 15px;
}

.recent-tools > button:hover:not(:disabled) {
  border-color: var(--moss);
  color: var(--moss);
  background: var(--paper);
}

.recent-tools > button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.project-search {
  width: 124px;
  height: 30px;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
}

.project-search svg {
  justify-self: center;
  color: var(--muted);
}

.project-search input {
  min-width: 0;
  height: 100%;
  padding: 0 8px 0 0;
  border: 0;
  outline: 0;
  color: var(--ink);
  background: transparent;
  font: inherit;
  font-size: 11px;
}

.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.project-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: transparent;
}

.project-list button {
  min-width: 0;
  min-height: 64px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.project-list button:not(:nth-child(3n)) {
  border-right: 1px solid var(--line);
}

.project-list button:hover {
  background: rgba(255, 255, 255, 0.66);
}

.project-list button > svg:first-child {
  color: var(--moss);
  font-size: 20px;
}

.project-list button > svg:last-child {
  color: var(--muted);
}

.project-list button span {
  min-width: 0;
}

.project-list strong,
.project-list small {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.project-list strong {
  font-size: 12px;
}

.project-list small {
  margin-top: 5px;
  color: var(--muted);
  font-size: 9px;
}

.project-list-toggle {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 10px auto 0;
  padding: 0 12px;
  border: 0;
  color: var(--moss);
  background: transparent;
  cursor: pointer;
  font-size: 9px;
  font-weight: 700;
}

.empty-projects {
  min-height: 112px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  border-bottom: 0;
  color: var(--muted);
  font-size: 11px;
}

.empty-projects svg {
  color: var(--moss);
  font-size: 20px;
}

.workspace-notice {
  position: fixed;
  right: 24px;
  bottom: 58px;
  z-index: 20;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--moss);
  color: white;
  background: var(--moss);
  font-size: 10px;
}

footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(20px, 3vw, 42px);
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: transparent;
  font-size: 8px;
  font-weight: 700;
}

@keyframes copy-arrive {
  from {
    transform: translateY(14px);
  }

  to {
    transform: translateY(0);
  }
}

@keyframes art-arrive {
  from {
    transform: scale(1.035);
  }

  to {
    transform: scale(1);
  }
}

@keyframes command-arrive {
  from {
    transform: translateY(8px);
  }

  to {
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .project-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-list button:not(:nth-child(3n)) {
    border-right: 0;
  }

  .project-list button:nth-child(odd) {
    border-right: 1px solid var(--line);
  }
}

@media (max-width: 820px) {
  main {
    padding: 14px 16px 32px;
  }

  .launch-console {
    min-height: 408px;
  }

  .launch-copy {
    width: 62%;
    padding: 34px 28px;
  }

  .launch-heading h1 {
    font-size: 32px;
  }

  .quick-actions {
    grid-template-columns: 1fr;
  }

  .launch-art {
    width: 46%;
    object-position: 50% 30%;
    clip-path: polygon(18% 0, 100% 0, 100% 100%, 0 100%);
  }

  .workspace-commands {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .workspace-commands a {
    min-height: 62px;
  }

  .workspace-commands a:nth-child(n + 4) {
    border-top: 1px solid var(--line);
  }
}

@media (max-width: 520px) {
  .workspace-launcher {
    grid-template-rows: 56px 1fr 34px;
  }

  .launcher-header {
    padding: 0 16px;
  }

  .launcher-brand strong {
    font-size: 14px;
  }

  .launcher-status {
    gap: 8px;
  }

  main {
    padding: 8px 14px 28px;
  }

  .launch-console {
    min-height: 500px;
  }

  .launch-copy {
    width: 100%;
    padding: 28px 20px 236px;
  }

  .launch-heading h1 {
    font-size: 31px;
  }

  .quick-actions {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 28px;
  }

  .quick-file-command,
  .quick-text-command {
    width: 100%;
  }

  .quick-file-command {
    min-height: 60px;
  }

  .launch-art {
    top: auto;
    width: 100%;
    height: 220px;
    object-position: 50% 28%;
    clip-path: none;
    opacity: 0.82;
    filter: saturate(0.82) brightness(0.76) contrast(1.08);
  }

  .workspace-commands a {
    min-height: 58px;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 8px;
    padding: 8px 5px;
  }

  .workspace-commands a > svg {
    width: 16px;
    height: 16px;
    padding: 6px;
  }

  .command-name strong {
    font-size: 10px;
  }

  .project-list {
    grid-template-columns: 1fr;
  }

  .project-list button,
  .project-list button:nth-child(odd) {
    border-right: 0;
  }

  .recent-heading {
    align-items: center;
    gap: 8px;
  }

  .recent-tools {
    min-width: 0;
    flex: 1;
    justify-content: flex-end;
  }

  .project-search {
    width: 104px;
    flex: 1;
  }

  .empty-projects {
    min-height: 96px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .launch-art,
  .launch-copy,
  .workspace-commands a {
    animation: none;
  }

  .launch-console::after,
  .quick-file-command,
  .quick-text-command button,
  .workspace-commands a,
  .workspace-commands a > svg {
    transition: none;
  }
}
</style>
