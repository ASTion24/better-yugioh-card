<template>
  <div class="print-app">
    <header class="app-bar">
      <a class="back-link" href="../editor/">
        <Icon icon="ri:arrow-left-line" />
        <span>单卡编辑</span>
      </a>
      <a class="brand" href="../">
        <span class="brand-mark">YG</span>
        <div>
          <h1>打印工作台</h1>
          <p>A4 · 59 × 86 mm</p>
        </div>
      </a>
      <div class="header-status" :class="{ active: summary.total > 0 }">
        {{ summary.total > 0 ? `${summary.total} 张待排版` : '等待卡组' }}
      </div>
    </header>

    <main class="workspace">
      <aside class="control-pane">
        <ProjectBar
          :project-id="activeProjectId"
          :name="projectName"
          :projects="projects"
          @select="selectProject"
          @rename="projectName = $event"
          @create="createProject"
          @save="saveCurrentProject"
          @duplicate="duplicateCurrentProject"
          @export="exportCurrentProject"
          @import="importProjectFile"
          @remove="removeCurrentProject"
        />
        <div v-if="externalUpdate" class="project-sync-warning">
          <span>项目已在其他标签页更新</span>
          <button type="button" @click="reloadExternalProject">重新载入</button>
        </div>
        <section class="control-section import-section">
          <div class="section-heading">
            <span class="section-index">01</span>
            <h2>导入卡组</h2>
            <button class="text-action" type="button" @click="loadSample">载入示例</button>
          </div>

          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept=".ydk,text/plain"
            @change="onFileChange"
          >
          <button
            class="drop-zone"
            :class="{ dragging: isDragging }"
            type="button"
            @click="fileInput?.click()"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <Icon class="drop-icon" icon="ri:upload-cloud-2-line" />
            <span>{{ fileName || '选择或拖入 .ydk' }}</span>
          </button>
          <div class="import-mode" aria-label="卡组导入方式">
            <button
              type="button"
              :class="{ active: importMode === 'replace' }"
              @click="importMode = 'replace'"
            >
              替换当前
            </button>
            <button
              type="button"
              :class="{ active: importMode === 'append' }"
              @click="importMode = 'append'"
            >
              追加到当前
            </button>
          </div>
          <DeckImageImporter
            @import="applyRecognizedDeck"
            @notice="deckActionMessage = $event"
          />

          <div class="paste-heading">
            <label for="deck-text-input">粘贴卡组文本或链接</label>
            <button type="button" @click="pasteDeckText">
              <Icon icon="ri:clipboard-line" />
              <span>粘贴</span>
            </button>
          </div>
          <textarea
            id="deck-text-input"
            v-model="deckText"
            class="deck-input"
            spellcheck="false"
            placeholder="#main ... 或粘贴卡组分享链接"
            aria-label="YDK 内容、YDKe 卡组码或卡组分享链接"
          />

          <div v-if="isImporting" class="inline-message">
            <Icon class="spinning" icon="ri:loader-4-line" />
            <span>正在读取远程卡组</span>
          </div>
          <div v-else-if="clipboardError || parseError" class="inline-message error-message">
            <Icon icon="ri:alert-line" />
            <span>{{ clipboardError || parseError }}</span>
          </div>
          <div v-else-if="warnings.length" class="inline-message warning-message">
            <Icon icon="ri:alert-line" />
            <span>{{ warnings[0] }}</span>
          </div>
          <button
            v-if="importUndo"
            class="undo-import"
            type="button"
            @click="undoLastImport"
          >
            <Icon icon="ri:arrow-go-back-line" />
            <span>撤销上次导入</span>
          </button>
        </section>

        <section class="control-section">
          <div class="section-heading">
            <span class="section-index">02</span>
            <h2>卡组编辑</h2>
            <button
              class="text-action"
              type="button"
              :disabled="isInspecting"
              @click="runProjectInspection"
            >
              {{ isInspecting ? '检查中' : '检查项目' }}
            </button>
          </div>
          <div class="section-selectors">
            <label class="section-check">
              <input v-model="selectedSections.main" type="checkbox">
              <span>主卡组</span>
              <strong>{{ summary.main }}</strong>
            </label>
            <label class="section-check">
              <input v-model="selectedSections.extra" type="checkbox">
              <span>额外</span>
              <strong>{{ summary.extra }}</strong>
            </label>
            <label class="section-check">
              <input v-model="selectedSections.side" type="checkbox">
              <span>副卡组</span>
              <strong>{{ summary.side }}</strong>
            </label>
          </div>
          <DeckEditor
            :deck="deck"
            :custom-cards="customCards"
            :action-message="deckActionMessage"
            @add-card="addDeckCard"
            @set-card-count="setDeckCardCount"
            @move-card="moveDeckCard"
            @reorder-card="reorderDeckCard"
            @download-ydk="downloadYdk"
            @copy-ydke="copyYdke"
            @create-batch="createBatchDraft"
            @playtest="openPlaytest"
            @edit-card="openCardEditor"
          />
          <PrintQueue
            :entries="printQueue"
            :custom-cards="customCards"
            @set-count="setPrintCount"
            @move="movePrintEntry"
            @remove="removePrintEntry"
            @reset="resetPrintQueue"
            @export-overview="exportDeckOverview"
          />
          <div v-if="inspectionIssues.length" class="inspection-panel">
            <header>
              <strong>项目检查</strong>
              <span>{{ inspectionSummary }}</span>
            </header>
            <article
              v-for="item in inspectionIssues"
              :key="item.id"
              :class="item.severity"
            >
              <Icon :icon="item.severity === 'error' ? 'ri:error-warning-line' : 'ri:alert-line'" />
              <span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.detail }}</small>
              </span>
              <button
                v-if="item.fix"
                type="button"
                @click="applyInspectionFix(item)"
              >
                修复
              </button>
            </article>
          </div>
        </section>

        <section class="control-section">
          <div class="section-heading">
            <span class="section-index">03</span>
            <h2>输出方式</h2>
          </div>

          <div class="mode-switch" aria-label="输出方式">
            <button
              type="button"
              :class="{ active: settings.mode === 'quick' }"
              @click="settings.mode = 'quick'"
            >
              <span>快速卡图</span>
              <small>约 300 DPI</small>
            </button>
            <button
              type="button"
              :class="{ active: settings.mode === 'high' }"
              @click="settings.mode = 'high'"
            >
              <span>高清重绘</span>
              <small>约 600 DPI</small>
            </button>
          </div>

          <label class="field-row">
            <span>卡面语言</span>
            <select v-model="settings.language" :disabled="settings.mode === 'high'">
              <option value="zh">中文</option>
              <option value="sc">简体中文</option>
              <option value="jp">日文</option>
              <option value="en">英文</option>
            </select>
          </label>

          <label class="field-row">
            <span>排版方式</span>
            <select v-model="settings.layout">
              <option value="center">居中 3 × 3</option>
              <option value="top-left">贴合左上</option>
              <option value="top-right">贴合右上</option>
              <option value="bottom-left">贴合左下</option>
              <option value="bottom-right">贴合右下</option>
              <option value="cut-efficient">省裁剪 10 张</option>
              <option value="dense">最密 11 张</option>
            </select>
          </label>

          <label class="range-row">
            <span>卡片间距</span>
            <input
              v-model.number="settings.gap"
              type="range"
              min="0"
              :max="maxLayoutGap"
              step="0.1"
            >
            <output>{{ settings.gap }} mm</output>
          </label>

          <label class="toggle-row">
            <input v-model="settings.cropMarks" type="checkbox">
            <span>裁切标记</span>
          </label>

          <label class="toggle-row">
            <input v-model="settings.duplex" type="checkbox">
            <span>双面打印卡背</span>
          </label>

          <template v-if="settings.duplex">
            <label class="field-row">
              <span>翻页方式</span>
              <select v-model="settings.duplexFlip">
                <option value="long-edge">长边翻页</option>
                <option value="short-edge">短边翻页</option>
              </select>
            </label>
            <div class="back-image-row">
              <span>卡背图片</span>
              <button type="button" @click="backFileInput?.click()">
                <Icon icon="ri:image-add-line" />
                <span>{{ settings.backImage ? '更换自定义卡背' : '使用自定义卡背' }}</span>
              </button>
              <button
                v-if="settings.backImage"
                type="button"
                title="恢复标准卡背"
                @click="settings.backImage = ''"
              >
                <Icon icon="ri:restart-line" />
              </button>
              <input
                ref="backFileInput"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                @change="onBackImageFile"
              >
            </div>
          </template>

          <details class="calibration">
            <summary>打印校准</summary>
            <div class="calibration-grid">
              <label>
                <span>水平偏移</span>
                <input
                  v-model.number="settings.offsetX"
                  type="number"
                  min="-5"
                  max="5"
                  step="0.5"
                >
              </label>
              <label>
                <span>垂直偏移</span>
                <input
                  v-model.number="settings.offsetY"
                  type="number"
                  min="-5"
                  max="5"
                  step="0.5"
                >
              </label>
            </div>
            <button
              class="calibration-download"
              type="button"
              @click="downloadCalibrationPage"
            >
              <Icon icon="ri:ruler-2-line" />
              <span>下载校准测试页</span>
            </button>
          </details>
        </section>

        <div class="generate-area">
          <div v-if="isGenerating" class="progress-block">
            <div class="progress-copy">
              <span>{{ generationMessage }}</span>
              <strong>{{ progressPercent }}%</strong>
            </div>
            <div class="progress-track">
              <span :style="{ width: `${progressPercent}%` }" />
            </div>
          </div>

          <button
            class="generate-button"
            type="button"
            :disabled="!canGenerate || isGenerating"
            @click="generatePdf"
          >
            <Icon icon="ri:printer-line" />
            <span>{{ isGenerating ? '正在生成' : '生成打印 PDF' }}</span>
          </button>
          <button
            class="delivery-button"
            type="button"
            :disabled="!canGenerate || isGenerating"
            @click="generateDeliveryZip"
          >
            <Icon icon="ri:archive-stack-line" />
            <span>生成完整交付包</span>
          </button>

          <div v-if="generationErrors.length" class="generation-errors">
            <p>{{ generationErrors.length }} 张卡片加载失败，PDF 中已保留卡号。</p>
            <ul>
              <li v-for="error in generationErrors.slice(0, 4)" :key="error.id">
                {{ error.id }} · {{ error.message }}
              </li>
            </ul>
          </div>
          <p v-else-if="completedMessage" class="completed-message">{{ completedMessage }}</p>
        </div>
      </aside>

      <section class="preview-pane">
        <div class="preview-toolbar">
          <div>
            <span class="eyebrow">PRINT PREVIEW</span>
            <h2>第 {{ currentPage + 1 }} 页</h2>
          </div>
          <div class="page-controls">
            <button
              type="button"
              title="上一页"
              :disabled="currentPage === 0"
              @click="currentPage -= 1"
            >
              <Icon icon="ri:arrow-left-line" />
            </button>
            <span>{{ currentPage + 1 }} / {{ pageCount }}</span>
            <button
              type="button"
              title="下一页"
              :disabled="currentPage >= pageCount - 1"
              @click="currentPage += 1"
            >
              <Icon icon="ri:arrow-right-line" />
            </button>
          </div>
        </div>

        <div class="page-stage">
          <div
            class="paper"
            aria-label="A4 卡片排版预览"
          >
            <div
              v-for="slot in previewSlots"
              :key="slot.key"
              class="card-slot"
              :class="{ empty: !slot.id, rotated: slot.rotation === 90 }"
              :style="slot.style"
            >
              <template v-if="slot.id">
                <CardThumbnail
                  :key="slot.dataUrl || previewLanguage"
                  :card-id="slot.id"
                  :custom-card="getCustomCard(customCards, slot.id)"
                  :source="slot.dataUrl || getPreviewSource(slot.id)"
                  :alt="`卡片 ${slot.id}`"
                />
                <span class="slot-label">{{ slot.label }}</span>
              </template>
            </div>
          </div>
        </div>

        <footer class="preview-footer">
          <span>{{ selectedCardIds.length }} 张</span>
          <span>{{ pageCount }} 页 A4</span>
          <span>{{ settings.mode === 'high' ? '高清重绘' : '完整卡图' }}</span>
        </footer>
      </section>
    </main>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import DeckImageImporter from './components/DeckImageImporter.vue';
import DeckEditor from './components/DeckEditor.vue';
import CardThumbnail from './components/CardThumbnail.vue';
import PrintQueue from './components/PrintQueue.vue';
import ProjectBar from './components/ProjectBar.vue';
import standardBackUrl from './assets/yugioh-card/yugioh-back/image/card-normal.png';
import {
  createBatchCard,
  resolvedCardToBatchCard,
} from './features/batch/batch-project';
import { resolveCard } from './features/cards/card-service';
import {
  getCustomCard,
  isCustomCardId,
} from './features/cards/custom-card';
import {
  fetchImageDataUrl,
  getCardPreviewUrl,
  isPrereleaseCardId,
} from './features/print/card-source';
import { preparePrintableCards } from './features/print/generator';
import {
  COMPACT_MAX_GAP_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  computeCardPositions,
  downloadBlob,
  generateCalibrationPdf,
  generatePrintablePdfWithOptions,
  getCardsPerPage,
} from './features/print/pdf';
import { generateDeckOverview } from './features/print/deck-overview';
import {
  createPrintQueue,
  flattenPrintQueue,
  movePrintQueueEntry,
  normalizePrintQueue,
} from './features/print/print-queue';
import {
  flattenDeck,
  mergeDecks,
  serializeYdk,
  serializeYdke,
  summarizeDeck,
} from './features/print/ydk';
import { resolveDeckInput } from './features/decks/remote-deck';
import { createDeliveryPackage } from './features/projects/delivery-package';
import {
  deleteProject,
  duplicateProject,
  getActiveProjectId,
  getProject,
  listProjects,
  parseProject,
  saveProject,
  serializeProject,
  setActiveProjectId,
  subscribeProjectChanges,
} from './features/projects/project-store';
import {
  inspectDeckProject,
  serializeInspectionReport,
} from './features/projects/project-validation';
import { createEmptyAnalysis } from './features/playtest/analysis';

const SAMPLE_DECK = `#created by Better YGO
#main
89631139
89631139
89631139
46986414
46986414
55144522
55144522
55144522
#extra
23995346
!side
12580477
12580477`;

const fileInput = ref(null);
const backFileInput = ref(null);
const fileName = ref('');
const deckText = ref('');
const deck = ref({
  main: [],
  extra: [],
  side: [],
  warnings: [],
});
const customCards = ref({});
const createEmptyPlaytest = () => ({
  roles: {},
  autoTaggedCardIds: [],
  customRoles: [],
  goals: [],
  activeGoalId: '',
  history: [],
  analysis: createEmptyAnalysis(),
});
const playtest = ref(createEmptyPlaytest());
const printQueue = ref([]);
const importUndo = ref(null);
const importMode = ref('replace');
const warnings = ref([]);
const parseError = ref('');
const clipboardError = ref('');
const isImporting = ref(false);
const isDragging = ref(false);
const currentPage = ref(0);
const isGenerating = ref(false);
const progress = reactive({ done: 0, total: 0 });
const generationErrors = ref([]);
const completedMessage = ref('');
const deckActionMessage = ref('');
const inspectionIssues = ref([]);
const isInspecting = ref(false);
const projects = ref([]);
const activeProjectId = ref('');
const activeProjectRevision = ref(0);
const projectName = ref('未命名卡组');
const externalUpdate = ref(null);
let projectSaveTimer;
let loadingProject = false;
let unsubscribeProjectChanges = () => {};
const generatedImageMap = ref(new Map());
const selectedSections = reactive({
  main: true,
  extra: true,
  side: true,
});
const settings = reactive({
  mode: 'quick',
  language: 'zh',
  layout: 'center',
  gap: 0.1,
  cropMarks: true,
  duplex: false,
  duplexFlip: 'long-edge',
  backImage: '',
  offsetX: 0,
  offsetY: 0,
});

const summary = computed(() => summarizeDeck(deck.value));
const activeSections = computed(() => {
  return Object.entries(selectedSections)
    .filter(([, enabled]) => enabled)
    .map(([section]) => section);
});
const selectedDeckCardIds = computed(() =>
  flattenDeck(deck.value, activeSections.value));
const selectedCardIds = computed(() => flattenPrintQueue(printQueue.value));
const cardsPerPage = computed(() => getCardsPerPage(settings.layout));
const maxLayoutGap = computed(() =>
  ['cut-efficient', 'dense'].includes(settings.layout)
    ? COMPACT_MAX_GAP_MM
    : 10);
const pageCount = computed(() =>
  Math.max(1, Math.ceil(selectedCardIds.value.length / cardsPerPage.value)));
const previewLanguage = computed(() => settings.mode === 'high' ? 'sc' : settings.language);
const previewSlots = computed(() => {
  const start = currentPage.value * cardsPerPage.value;
  const ids = selectedCardIds.value.slice(
    start,
    start + cardsPerPage.value,
  );
  const positions = computeCardPositions(cardsPerPage.value, {
    layout: settings.layout,
    gap: settings.gap,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
  });
  return positions.map((position, index) => {
    const id = ids[index] || '';
    return {
      id,
      label: getCustomCard(customCards.value, id)?.data?.password || id,
      dataUrl: id
        ? generatedImageMap.value.get(id)
        : '',
      key: `${currentPage.value}-${index}-${id || 'empty'}`,
      rotation: position.rotation,
      style: {
        left: `${position.x / PAGE_WIDTH_MM * 100}%`,
        top: `${position.y / PAGE_HEIGHT_MM * 100}%`,
        width: `${position.width / PAGE_WIDTH_MM * 100}%`,
        height: `${position.height / PAGE_HEIGHT_MM * 100}%`,
      },
    };
  });
});
const canGenerate = computed(() => {
  return selectedCardIds.value.length > 0 && !parseError.value;
});
const inspectionSummary = computed(() => {
  const errors = inspectionIssues.value.filter(item =>
    item.severity === 'error').length;
  const warnings = inspectionIssues.value.length - errors;
  return `${errors} 个错误 · ${warnings} 个警告`;
});
const getPreviewSource = id => {
  return isCustomCardId(id)
    ? ''
    : getCardPreviewUrl(id, previewLanguage.value);
};
const progressPercent = computed(() => {
  if (!progress.total) return 0;
  return Math.round(progress.done / progress.total * 100);
});
const generationMessage = computed(() => {
  if (settings.mode === 'high') {
    return `高清渲染 ${progress.done} / ${progress.total}`;
  }
  return `获取卡图 ${progress.done} / ${progress.total}`;
});
let parseRequest = 0;
let suppressedDeckTextValue = null;
let prereleasePreviewRequest = 0;
let prereleasePreviewTimer;

const schedulePrereleasePreviews = () => {
  const request = ++prereleasePreviewRequest;
  clearTimeout(prereleasePreviewTimer);
  prereleasePreviewTimer = setTimeout(async () => {
    const ids = [...new Set(selectedCardIds.value)]
      .filter(isPrereleaseCardId)
      .filter(id => !generatedImageMap.value.has(id));
    if (!ids.length) return;
    const result = await preparePrintableCards(ids, {
      mode: 'high',
      language: 'sc',
      customCards: customCards.value,
    });
    if (request !== prereleasePreviewRequest) return;
    const nextImages = new Map(generatedImageMap.value);
    result.cards.forEach(card => {
      if (card?.dataUrl) nextImages.set(String(card.id), card.dataUrl);
    });
    generatedImageMap.value = nextImages;
  }, 120);
};

const cloneDeck = value => ({
  main: [...(value?.main || [])],
  extra: [...(value?.extra || [])],
  side: [...(value?.side || [])],
  warnings: [...(value?.warnings || [])],
});

const syncDeckTextFromDeck = value => {
  const serialized = serializeYdk(value);
  if (deckText.value === serialized) return;
  suppressedDeckTextValue = serialized;
  deckText.value = serialized;
};

const resetPrintQueue = () => {
  printQueue.value = createPrintQueue(selectedDeckCardIds.value);
  currentPage.value = 0;
};

const setPrintCount = ({ id, count }) => {
  printQueue.value = printQueue.value.map(entry =>
    entry.id === id
      ? { ...entry, count: Math.min(99, Math.max(0, Number(count) || 0)) }
      : entry);
};

const movePrintEntry = ({ index, direction }) => {
  printQueue.value = movePrintQueueEntry(
    printQueue.value,
    index,
    direction,
  );
};

const removePrintEntry = id => {
  printQueue.value = printQueue.value.filter(entry => entry.id !== id);
};

const captureImportUndo = () => {
  if (importUndo.value || loadingProject) return;
  const hasDeckData = ['main', 'extra', 'side']
    .some(section => deck.value[section].length);
  if (!hasDeckData && !Object.keys(customCards.value).length) return;
  importUndo.value = {
    deck: cloneDeck(deck.value),
    customCards: JSON.parse(JSON.stringify(customCards.value)),
    printQueue: normalizePrintQueue(printQueue.value),
    projectName: projectName.value,
    fileName: fileName.value,
  };
};

const parseCurrentDeck = async () => {
  const request = ++parseRequest;
  completedMessage.value = '';
  deckActionMessage.value = '';
  generationErrors.value = [];
  generatedImageMap.value = new Map();
  importUndo.value = null;
  if (!deckText.value.trim()) {
    captureImportUndo();
    deck.value = { main: [], extra: [], side: [], warnings: [] };
    customCards.value = {};
    printQueue.value = [];
    warnings.value = [];
    parseError.value = '';
    currentPage.value = 0;
    return;
  }
  try {
    isImporting.value = /^https?:\/\//i.test(deckText.value.trim());
    const parsed = await resolveDeckInput(deckText.value);
    if (request !== parseRequest) return;
    captureImportUndo();
    const shouldAppend = importMode.value === 'append';
    const nextDeck = shouldAppend
      ? mergeDecks(deck.value, parsed)
      : parsed;
    deck.value = nextDeck;
    if (!shouldAppend) {
      customCards.value = {};
      if (parsed.name && ['未命名卡组', ''].includes(projectName.value)) {
        projectName.value = parsed.name;
      }
    }
    warnings.value = nextDeck.warnings || [];
    parseError.value = '';
    currentPage.value = 0;
    resetPrintQueue();
    if (shouldAppend) {
      const added = ['main', 'extra', 'side'].reduce(
        (total, section) => total + (parsed[section]?.length || 0),
        0,
      );
      importMode.value = 'replace';
      syncDeckTextFromDeck(nextDeck);
      deckActionMessage.value = `已追加 ${added} 张卡片`;
    }
  } catch (error) {
    if (request !== parseRequest) return;
    parseError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (request === parseRequest) {
      isImporting.value = false;
    }
  }
};

let parseTimer;
watch(deckText, value => {
  if (suppressedDeckTextValue !== null &&
    value === suppressedDeckTextValue) {
    suppressedDeckTextValue = null;
    return;
  }
  suppressedDeckTextValue = null;
  clearTimeout(parseTimer);
  clipboardError.value = '';
  parseTimer = setTimeout(() => {
    parseCurrentDeck();
  }, 240);
});

watch(pageCount, count => {
  currentPage.value = Math.min(currentPage.value, count - 1);
});

watch(() => settings.mode, mode => {
  generatedImageMap.value = new Map();
  if (mode === 'high') {
    settings.language = 'sc';
  }
});

watch(() => settings.language, () => {
  generatedImageMap.value = new Map();
});

watch(
  () => [
    selectedCardIds.value.filter(isPrereleaseCardId).join(','),
    settings.mode,
    settings.language,
  ],
  schedulePrereleasePreviews,
  { immediate: true },
);

watch(() => settings.layout, layout => {
  if (['cut-efficient', 'dense'].includes(layout) &&
    settings.gap > COMPACT_MAX_GAP_MM) {
    settings.gap = COMPACT_MAX_GAP_MM;
  }
  currentPage.value = 0;
});

const readDeckFile = async file => {
  if (!file.name.toLowerCase().endsWith('.ydk')) {
    parseError.value = '请选择 .ydk 文件';
    return;
  }
  captureImportUndo();
  fileName.value = file.name;
  deckText.value = await file.text();
};

const onBackImageFile = event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    parseError.value = '请选择图片格式的卡背';
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    settings.backImage = String(reader.result);
  };
  reader.onerror = () => {
    parseError.value = '卡背图片读取失败';
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

const onFileChange = event => {
  const file = event.target.files?.[0];
  if (file) {
    readDeckFile(file);
  }
  event.target.value = '';
};

const onDrop = event => {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    readDeckFile(file);
  }
};

const loadSample = () => {
  captureImportUndo();
  importMode.value = 'replace';
  fileName.value = 'sample.ydk';
  projectName.value = '示例卡组';
  deckText.value = SAMPLE_DECK;
};

const applyRecognizedDeck = payload => {
  const recognized = payload?.deck;
  if (!recognized) return;
  captureImportUndo();
  const shouldAppend = importMode.value === 'append';
  const nextDeck = shouldAppend
    ? mergeDecks(deck.value, recognized)
    : recognized;
  deck.value = nextDeck;
  if (!shouldAppend) {
    customCards.value = {};
    fileName.value = `${payload.name || 'image-deck'}.ydk`;
    if (payload.name &&
      ['未命名卡组', ''].includes(projectName.value)) {
      projectName.value = payload.name;
    }
  }
  warnings.value = nextDeck.warnings || [];
  parseError.value = '';
  currentPage.value = 0;
  generatedImageMap.value = new Map();
  resetPrintQueue();
  syncDeckTextFromDeck(nextDeck);
  deckActionMessage.value = shouldAppend
    ? `已从图片追加 ${payload.detected} 张卡片`
    : `已从图片导入 ${payload.detected} 张卡片`;
  if (shouldAppend) importMode.value = 'replace';
};

const pasteDeckText = async () => {
  try {
    const value = await navigator.clipboard.readText();
    if (!value.trim()) {
      clipboardError.value = '剪贴板中没有 YDK 文本';
      return;
    }
    captureImportUndo();
    fileName.value = '';
    clipboardError.value = '';
    deckText.value = value;
  } catch {
    clipboardError.value = '无法读取剪贴板，请直接粘贴到文本框';
  }
};

const commitDeckChange = nextDeck => {
  const normalizedDeck = {
    ...deck.value,
    main: [...nextDeck.main],
    extra: [...nextDeck.extra],
    side: [...nextDeck.side],
    warnings: [],
  };
  deck.value = normalizedDeck;
  warnings.value = [];
  parseError.value = '';
  completedMessage.value = '';
  generationErrors.value = [];
  generatedImageMap.value = new Map();
  const usedCustomIds = new Set([
    ...flattenDeck(normalizedDeck),
    ...flattenPrintQueue(printQueue.value),
  ]);
  customCards.value = Object.fromEntries(
    Object.entries(customCards.value)
      .filter(([id]) => usedCustomIds.has(id)),
  );
  syncDeckTextFromDeck(normalizedDeck);
};

const refreshProjects = async () => {
  projects.value = await listProjects('deck');
};

const projectSnapshot = () => ({
  id: activeProjectId.value,
  revision: activeProjectRevision.value,
  kind: 'deck',
  name: projectName.value,
  deck: {
    main: [...deck.value.main],
    extra: [...deck.value.extra],
    side: [...deck.value.side],
  },
  customCards: JSON.parse(JSON.stringify(customCards.value)),
  playtest: JSON.parse(JSON.stringify(playtest.value)),
  printQueue: normalizePrintQueue(printQueue.value),
  selectedSections: { ...selectedSections },
  settings: { ...settings },
});

const runProjectInspection = async () => {
  if (isInspecting.value) return inspectionIssues.value;
  isInspecting.value = true;
  deckActionMessage.value = '正在检查项目';
  try {
    inspectionIssues.value = await inspectDeckProject(projectSnapshot());
    deckActionMessage.value = inspectionIssues.value.length
      ? `检查完成 · ${inspectionSummary.value}`
      : '检查完成 · 未发现问题';
    return inspectionIssues.value;
  } finally {
    isInspecting.value = false;
  }
};

const applyInspectionFix = async item => {
  const fix = item.fix;
  if (!fix) return;
  if (fix.type === 'reset-print-queue') {
    resetPrintQueue();
  } else if (fix.type === 'move-section') {
    moveDeckCard({
      sourceSection: fix.from,
      targetSection: fix.to,
      id: fix.id,
    });
  } else if (fix.type === 'remove-card') {
    const nextDeck = {
      ...deck.value,
      main: deck.value.main.filter(id => String(id) !== fix.id),
      extra: deck.value.extra.filter(id => String(id) !== fix.id),
      side: deck.value.side.filter(id => String(id) !== fix.id),
    };
    printQueue.value = printQueue.value.filter(entry => entry.id !== fix.id);
    const nextCustomCards = { ...customCards.value };
    delete nextCustomCards[fix.id];
    customCards.value = nextCustomCards;
    commitDeckChange(nextDeck);
  }
  await runProjectInspection();
};

const ensureProjectReady = async () => {
  const issues = await runProjectInspection();
  return !issues.some(item => item.severity === 'error');
};

const saveCurrentProject = async () => {
  try {
    const saved = await saveProject(projectSnapshot());
    activeProjectId.value = saved.id;
    activeProjectRevision.value = saved.revision;
    projectName.value = saved.name;
    externalUpdate.value = null;
    setActiveProjectId(saved.id);
    await refreshProjects();
    deckActionMessage.value = '项目已保存';
    return saved;
  } catch (error) {
    deckActionMessage.value = error instanceof Error
      ? error.message
      : String(error);
    return null;
  }
};

const duplicateCurrentProject = async () => {
  const saved = await duplicateProject(projectSnapshot());
  await refreshProjects();
  await applyProject(saved);
  deckActionMessage.value = '已创建项目副本';
};

const applyProject = async project => {
  if (!project || (project.kind || 'deck') !== 'deck') return;
  loadingProject = true;
  activeProjectId.value = project.id;
  activeProjectRevision.value = project.revision || 0;
  projectName.value = project.name;
  externalUpdate.value = null;
  Object.assign(settings, project.settings || {});
  Object.assign(selectedSections, project.selectedSections || {});
  deck.value = {
    main: [...(project.deck?.main || [])],
    extra: [...(project.deck?.extra || [])],
    side: [...(project.deck?.side || [])],
    warnings: [],
  };
  customCards.value = JSON.parse(JSON.stringify(project.customCards || {}));
  playtest.value = JSON.parse(JSON.stringify(
    project.playtest || createEmptyPlaytest(),
  ));
  printQueue.value = Array.isArray(project.printQueue)
    ? normalizePrintQueue(project.printQueue)
    : createPrintQueue(selectedDeckCardIds.value);
  importUndo.value = null;
  syncDeckTextFromDeck(deck.value);
  setActiveProjectId(project.id);
  setTimeout(() => {
    loadingProject = false;
  });
};

const selectProject = async id => {
  if (!id) {
    createProject();
    return;
  }
  await applyProject(await getProject(id));
};

const createProject = () => {
  loadingProject = true;
  activeProjectId.value = '';
  activeProjectRevision.value = 0;
  projectName.value = '未命名卡组';
  fileName.value = '';
  deckText.value = '';
  deck.value = { main: [], extra: [], side: [], warnings: [] };
  customCards.value = {};
  playtest.value = createEmptyPlaytest();
  printQueue.value = [];
  importUndo.value = null;
  setActiveProjectId('');
  setTimeout(() => {
    loadingProject = false;
  });
};

const reloadExternalProject = async () => {
  if (!activeProjectId.value) return;
  await applyProject(await getProject(activeProjectId.value));
  await refreshProjects();
  deckActionMessage.value = '已载入其他标签页的最新版本';
};

const removeCurrentProject = async () => {
  if (!activeProjectId.value ||
    !window.confirm(`删除“${projectName.value}”？此操作无法撤销。`)) {
    return;
  }
  await deleteProject(activeProjectId.value);
  createProject();
  await refreshProjects();
};

const exportCurrentProject = () => {
  const blob = new Blob([serializeProject(projectSnapshot())], {
    type: 'application/json;charset=utf-8',
  });
  downloadBlob(blob, `${getDeckFilenameStem()}.ygoproject`);
};

const importProjectFile = async file => {
  try {
    const imported = parseProject(await file.text());
    if (imported.kind !== 'deck') {
      throw new Error('这个文件不是卡组项目');
    }
    const saved = await saveProject(imported);
    await refreshProjects();
    await applyProject(saved);
    deckActionMessage.value = '项目已导入';
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : String(error);
  }
};

const undoLastImport = () => {
  if (!importUndo.value) return;
  const snapshot = importUndo.value;
  importUndo.value = null;
  loadingProject = true;
  deck.value = cloneDeck(snapshot.deck);
  customCards.value = JSON.parse(JSON.stringify(snapshot.customCards));
  printQueue.value = Array.isArray(snapshot.printQueue)
    ? normalizePrintQueue(snapshot.printQueue)
    : createPrintQueue(selectedDeckCardIds.value);
  projectName.value = snapshot.projectName;
  fileName.value = snapshot.fileName;
  warnings.value = [...(snapshot.deck.warnings || [])];
  parseError.value = '';
  generatedImageMap.value = new Map();
  syncDeckTextFromDeck(deck.value);
  setTimeout(() => {
    loadingProject = false;
  });
  deckActionMessage.value = '已撤销上次导入';
};

const openCardEditor = async ({ id, section }) => {
  const saved = await saveCurrentProject();
  if (!saved) return;
  const url = new URL('../editor/', location.href);
  url.searchParams.set('card', String(id));
  url.searchParams.set('deckProject', activeProjectId.value);
  url.searchParams.set('deckSection', section);
  location.href = url;
};

const openPlaytest = async () => {
  const saved = await saveCurrentProject();
  if (!saved) return;
  location.href = '../playtest/';
};

const createBatchDraft = async () => {
  const ids = [...new Set(flattenDeck(deck.value))];
  if (!ids.length) return;
  deckActionMessage.value = '正在生成可编辑草稿';
  try {
    const cards = await Promise.all(ids.map(async id => {
      const customCard = getCustomCard(customCards.value, id);
      if (customCard) {
        return createBatchCard(customCard.data, {
          name: customCard.name,
          sourceCardId: customCard.sourceCardId,
        });
      }
      return resolvedCardToBatchCard(
        await resolveCard(id),
      );
    }));
    const saved = await saveProject({
      kind: 'batch',
      name: `${projectName.value} · 可编辑草稿`,
      cards,
    });
    setActiveProjectId(saved.id, 'batch');
    location.href = '../batch/';
  } catch (error) {
    deckActionMessage.value = error instanceof Error
      ? error.message
      : String(error);
  }
};

const addDeckCard = ({ section, id }) => {
  commitDeckChange({
    ...deck.value,
    [section]: [...deck.value[section], String(id)],
  });
};

const setDeckCardCount = ({ section, id, count }) => {
  const cardId = String(id);
  const nextCount = Math.min(99, Math.max(0, Number(count) || 0));
  const current = deck.value[section];
  const firstIndex = current.indexOf(cardId);
  const withoutCard = current.filter(value => value !== cardId);
  if (nextCount > 0) {
    const insertAt = firstIndex < 0 ? withoutCard.length : firstIndex;
    withoutCard.splice(
      insertAt,
      0,
      ...Array.from({ length: nextCount }, () => cardId),
    );
  }
  commitDeckChange({
    ...deck.value,
    [section]: withoutCard,
  });
};

const moveDeckCard = ({ sourceSection, targetSection, id }) => {
  const cardId = String(id);
  const count = deck.value[sourceSection]
    .filter(value => value === cardId)
    .length;
  if (!count || sourceSection === targetSection) {
    return;
  }
  commitDeckChange({
    ...deck.value,
    [sourceSection]: deck.value[sourceSection]
      .filter(value => value !== cardId),
    [targetSection]: [
      ...deck.value[targetSection],
      ...Array.from({ length: count }, () => cardId),
    ],
  });
};

const reorderDeckCard = ({ sourceSection, targetSection, id, beforeId }) => {
  const cardId = String(id);
  const movedCards = deck.value[sourceSection].filter(value => value === cardId);
  if (!movedCards.length) return;
  const nextSource = deck.value[sourceSection].filter(value => value !== cardId);
  const nextTarget = sourceSection === targetSection
    ? nextSource
    : deck.value[targetSection].filter(value => value !== cardId);
  const beforeIndex = beforeId
    ? nextTarget.indexOf(String(beforeId))
    : -1;
  nextTarget.splice(
    beforeIndex < 0 ? nextTarget.length : beforeIndex,
    0,
    ...movedCards,
  );
  commitDeckChange({
    ...deck.value,
    [sourceSection]: sourceSection === targetSection ? nextTarget : nextSource,
    [targetSection]: nextTarget,
  });
};

const getDeckFilenameStem = () => {
  return (fileName.value || deck.value.name || 'yugioh-deck')
    .replace(/\.ydk$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-');
};

const downloadYdk = () => {
  const blob = new Blob([serializeYdk(deck.value)], {
    type: 'text/plain;charset=utf-8',
  });
  downloadBlob(blob, `${getDeckFilenameStem()}.ydk`);
  const customCount = flattenDeck(deck.value).filter(isCustomCardId).length;
  deckActionMessage.value = customCount
    ? `YDK 已下载；${customCount} 张原创卡仅保留在工作台项目中`
    : 'YDK 已下载';
};

const copyYdke = async () => {
  const value = serializeYdke(deck.value);
  try {
    await navigator.clipboard.writeText(value);
    const customCount = flattenDeck(deck.value).filter(isCustomCardId).length;
    deckActionMessage.value = customCount
      ? `YDKe 已复制；${customCount} 张原创卡未包含`
      : 'YDKe 已复制';
  } catch {
    suppressedDeckTextValue = value;
    deckText.value = value;
    deckActionMessage.value = 'YDKe 已放入输入框';
  }
};

const getPdfFilename = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `${getDeckFilenameStem()}-${settings.mode}-${date}.pdf`;
};

const resolveDeckNames = async () => {
  const ids = [...new Set(flattenDeck(deck.value))];
  const names = {};
  await Promise.all(ids.map(async id => {
    const customCard = getCustomCard(customCards.value, id);
    if (customCard) {
      names[id] = customCard.name;
      return;
    }
    try {
      names[id] = (await resolveCard(id)).name;
    } catch {
      names[id] = id;
    }
  }));
  return names;
};

const createOverviewBlob = async () => {
  const blob = await generateDeckOverview(deck.value, {
    name: projectName.value,
    customCards: customCards.value,
    names: await resolveDeckNames(),
  });
  if (!blob) throw new Error('总览图生成失败');
  return blob;
};

const exportDeckOverview = async () => {
  deckActionMessage.value = '正在生成卡组总览图';
  try {
    downloadBlob(
      await createOverviewBlob(),
      `${getDeckFilenameStem()}-overview.png`,
    );
    deckActionMessage.value = '卡组总览图已导出';
  } catch (error) {
    deckActionMessage.value = error instanceof Error
      ? error.message
      : String(error);
  }
};

const downloadCalibrationPage = async () => {
  const blob = await generateCalibrationPdf({
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
  });
  downloadBlob(blob, 'a4-59x86-calibration.pdf');
  deckActionMessage.value = '校准测试页已下载';
};

const createPrintablePdfBlob = async () => {
  progress.done = 0;
  progress.total = new Set(selectedCardIds.value).size;
  const result = await preparePrintableCards(selectedCardIds.value, {
    mode: settings.mode,
    language: previewLanguage.value,
    customCards: customCards.value,
    onProgress: value => {
      progress.done = value.done;
      progress.total = value.total;
    },
  });
  const backImage = settings.duplex
    ? settings.backImage || await fetchImageDataUrl(standardBackUrl)
    : '';
  const blob = await generatePrintablePdfWithOptions(result.cards, {
    gap: settings.gap,
    layout: settings.layout,
    cropMarks: settings.cropMarks,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
    backImage,
    duplexFlip: settings.duplexFlip,
  });
  generatedImageMap.value = new Map(
    selectedCardIds.value.map((id, index) => [
      id,
      result.cards[index]?.dataUrl,
    ]),
  );
  return { blob, result };
};

const generatePdf = async () => {
  if (!canGenerate.value || isGenerating.value) {
    return;
  }
  if (!await ensureProjectReady()) {
    completedMessage.value = '项目检查未通过，请先修复错误';
    return;
  }
  isGenerating.value = true;
  completedMessage.value = '';
  generationErrors.value = [];

  try {
    const { blob, result } = await createPrintablePdfBlob();
    downloadBlob(blob, getPdfFilename());
    generationErrors.value = result.errors;
    const prereleaseMessage = result.prereleaseFallbacks.length
      ? ` · ${result.prereleaseFallbacks.length} 张先行卡使用测试卡图`
      : '';
    const fullCardMessage = result.fullCardFallbacks.length
      ? ` · ${result.fullCardFallbacks.length} 张超框或异画卡保留完整卡图`
      : '';
    completedMessage.value =
      `已生成 ${result.cards.length} 张卡片` +
      `${settings.duplex ? ' · 含双面卡背' : ''}` +
      `${prereleaseMessage}${fullCardMessage}`;
  } catch (error) {
    generationErrors.value = [{
      id: 'PDF',
      message: error instanceof Error ? error.message : String(error),
    }];
  } finally {
    isGenerating.value = false;
  }
};

const generateDeliveryZip = async () => {
  if (!canGenerate.value || isGenerating.value) return;
  if (!await ensureProjectReady()) {
    completedMessage.value = '项目检查未通过，请先修复错误';
    return;
  }
  isGenerating.value = true;
  completedMessage.value = '';
  generationErrors.value = [];
  try {
    const [{ blob: pdf, result }, overview] = await Promise.all([
      createPrintablePdfBlob(),
      createOverviewBlob(),
    ]);
    generationErrors.value = result.errors;
    const deliveryIssues = [
      ...inspectionIssues.value,
      ...result.errors.map(error => ({
        severity: 'error',
        title: '卡图生成失败',
        detail: `${error.id} · ${error.message}`,
      })),
    ];
    const stem = getDeckFilenameStem();
    const archive = await createDeliveryPackage({
      [`${stem}.pdf`]: pdf,
      [`${stem}-overview.png`]: overview,
      [`${stem}.ydk`]: serializeYdk(deck.value),
      [`${stem}.ygoproject`]: serializeProject(projectSnapshot()),
      [`${stem}-inspection.txt`]: serializeInspectionReport(
        projectSnapshot(),
        deliveryIssues,
      ),
    });
    downloadBlob(archive, `${stem}-delivery.zip`);
    completedMessage.value =
      `交付包已生成 · ${result.cards.length} 张卡片 · ` +
      `${deliveryIssues.length} 项检查记录`;
  } catch (error) {
    generationErrors.value = [{
      id: 'DELIVERY',
      message: error instanceof Error ? error.message : String(error),
    }];
  } finally {
    isGenerating.value = false;
  }
};

watch(
  () => ({
    id: activeProjectId.value,
    name: projectName.value,
    deck: deck.value,
    customCards: customCards.value,
    playtest: playtest.value,
    printQueue: printQueue.value,
    sections: { ...selectedSections },
    settings: { ...settings },
  }),
  () => {
    if (!activeProjectId.value || loadingProject || externalUpdate.value) return;
    clearTimeout(projectSaveTimer);
    projectSaveTimer = setTimeout(saveCurrentProject, 700);
  },
  { deep: true },
);

onMounted(async () => {
  unsubscribeProjectChanges = subscribeProjectChanges(change => {
    if (change?.type === 'saved' &&
      change.id === activeProjectId.value &&
      change.revision > activeProjectRevision.value) {
      clearTimeout(projectSaveTimer);
      externalUpdate.value = change;
    }
  });
  try {
    await refreshProjects();
    const activeId = getActiveProjectId();
    if (activeId) {
      await applyProject(await getProject(activeId));
    }
  } catch (error) {
    deckActionMessage.value = error instanceof Error ? error.message : String(error);
  }
});

onBeforeUnmount(() => {
  unsubscribeProjectChanges();
});
</script>

<style lang="scss" scoped>
.print-app {
  --paper: #fffefa;
  --canvas: #f3f1ec;
  --ink: #1c1d1b;
  --muted: #74736e;
  --line: #d8d5ce;
  --strong-line: #b7b3aa;
  --accent: #b94532;
  --teal: #285e58;
  min-height: 100vh;
  color: var(--ink);
  background: var(--canvas);
}

.project-sync-warning {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 6px 14px;
  border-bottom: 1px solid #d6a49a;
  color: #743226;
  background: #f8e8e3;
  font-size: 10px;
}

.project-sync-warning button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 3px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

button,
select,
textarea,
input {
  font: inherit;
}

button,
a,
summary,
label {
  -webkit-tap-highlight-color: transparent;
}

.app-bar {
  height: 72px;
  display: grid;
  grid-template-columns: 180px 1fr 180px;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(243, 241, 236, 0.96);
}

.back-link {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover {
  color: var(--ink);
}

.brand {
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ink);
  text-decoration: none;
}

.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ink);
  font-family: "Avenir Next Condensed", "PingFang SC", sans-serif;
  font-weight: 800;
  font-size: 13px;
}

.brand h1 {
  margin: 0;
  font-family: "Songti SC", "STSong", serif;
  font-size: 20px;
  line-height: 1.1;
  font-weight: 700;
}

.brand p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.header-status {
  justify-self: end;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.header-status.active {
  color: var(--teal);
  font-weight: 700;
}

.workspace {
  min-height: calc(100vh - 72px);
  display: grid;
  grid-template-columns: minmax(340px, 410px) 1fr;
}

.control-pane {
  border-right: 1px solid var(--line);
  background: #f8f7f3;
}

.control-section {
  padding: 26px 28px;
  border-bottom: 1px solid var(--line);
}

.section-heading {
  min-height: 26px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.section-index {
  color: var(--accent);
  font-family: "Avenir Next Condensed", sans-serif;
  font-size: 11px;
  font-weight: 800;
}

.text-action {
  margin-left: auto;
  padding: 4px 0;
  border: 0;
  color: var(--teal);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.drop-zone {
  width: 100%;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--strong-line);
  border-radius: 4px;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background-color 160ms ease;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--teal);
  color: var(--teal);
  background: #edf3f0;
}

.drop-icon {
  font-size: 20px;
}

.import-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}

.import-mode button {
  height: 32px;
  border: 0;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 10px;
}

.import-mode button + button {
  border-left: 1px solid var(--line);
}

.import-mode button.active {
  color: white;
  background: var(--ink);
}

.paste-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.paste-heading label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.paste-heading button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 0;
  border: 0;
  color: var(--teal);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}

.deck-input {
  width: 100%;
  min-height: 118px;
  margin-top: 7px;
  padding: 12px 13px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 4px;
  outline: none;
  color: var(--ink);
  background: var(--paper);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
}

.deck-input:focus {
  border-color: var(--teal);
  box-shadow: 0 0 0 2px rgba(40, 94, 88, 0.1);
}

.inline-message {
  display: flex;
  gap: 7px;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.4;
}

.error-message {
  color: var(--accent);
}

.warning-message {
  color: #8b6524;
}

.undo-import {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  padding: 0;
  border: 0;
  color: var(--teal);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}

.section-selectors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.section-check {
  min-width: 0;
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 6px 7px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 4px;
  cursor: pointer;
  background: var(--paper);
}

.section-check input {
  accent-color: var(--teal);
}

.section-check span {
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.section-check strong {
  grid-column: 2;
  color: var(--muted);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.inspection-panel {
  margin-top: 14px;
  border: 1px solid var(--line);
  background: var(--paper);
}

.inspection-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px;
  border-bottom: 1px solid var(--line);
  font-size: 9px;
}

.inspection-panel > header span {
  color: var(--muted);
}

.inspection-panel article {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 8px 9px;
  border-bottom: 1px solid var(--line);
}

.inspection-panel article:last-child {
  border-bottom: 0;
}

.inspection-panel article > svg {
  color: #8b6524;
}

.inspection-panel article.error > svg {
  color: var(--accent);
}

.inspection-panel article span,
.inspection-panel article strong,
.inspection-panel article small {
  min-width: 0;
  display: block;
}

.inspection-panel article strong {
  font-size: 9px;
}

.inspection-panel article small {
  margin-top: 2px;
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspection-panel article button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: var(--paper);
  cursor: pointer;
  font-size: 8px;
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--strong-line);
  border-radius: 4px;
  overflow: hidden;
}

.mode-switch button {
  min-width: 0;
  padding: 11px 8px;
  border: 0;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
}

.mode-switch button + button {
  border-left: 1px solid var(--strong-line);
}

.mode-switch button.active {
  color: white;
  background: var(--ink);
}

.mode-switch span,
.mode-switch small {
  display: block;
}

.mode-switch span {
  font-weight: 700;
}

.mode-switch small {
  margin-top: 3px;
  font-size: 10px;
  opacity: 0.7;
}

.field-row,
.range-row,
.toggle-row {
  display: flex;
  align-items: center;
  margin-top: 17px;
  font-size: 12px;
}

.field-row > span,
.range-row > span {
  width: 78px;
  flex: 0 0 auto;
  color: var(--muted);
}

.field-row select {
  height: 34px;
  flex: 1;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
}

.range-row input {
  min-width: 0;
  flex: 1;
  accent-color: var(--teal);
}

.range-row output {
  width: 54px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.toggle-row {
  gap: 9px;
  color: var(--ink);
}

.toggle-row input {
  accent-color: var(--teal);
}

.back-image-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
}

.back-image-row button {
  min-width: 0;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 9px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
  font-size: 10px;
  white-space: nowrap;
}

.calibration {
  margin-top: 16px;
  border-top: 1px solid var(--line);
}

.calibration summary {
  padding: 14px 0 0;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
}

.calibration-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.calibration-grid label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
}

.calibration-grid input {
  width: 100%;
  height: 34px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--paper);
}

.calibration-download,
.delivery-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
  font-size: 10px;
}

.calibration-download {
  height: 34px;
  margin-top: 8px;
}

.generate-area {
  padding: 24px 28px 32px;
}

.generate-button {
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  color: white;
  background: var(--ink);
  cursor: pointer;
  font-weight: 700;
  transition: background-color 160ms ease, transform 160ms ease;
}

.generate-button:hover:not(:disabled) {
  background: var(--teal);
  transform: translateY(-1px);
}

.generate-button:disabled {
  border-color: var(--line);
  color: #a5a29b;
  background: #e7e4de;
  cursor: not-allowed;
}

.delivery-button {
  height: 40px;
  margin-top: 7px;
}

.delivery-button:hover:not(:disabled),
.calibration-download:hover {
  border-color: var(--teal);
  color: var(--teal);
}

.delivery-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.progress-block {
  margin-bottom: 14px;
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  margin-bottom: 7px;
  color: var(--muted);
  font-size: 11px;
}

.progress-track {
  height: 3px;
  overflow: hidden;
  background: var(--line);
}

.progress-track span {
  height: 100%;
  display: block;
  background: var(--accent);
  transition: width 180ms ease;
}

.generation-errors,
.completed-message {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.5;
}

.generation-errors {
  color: var(--accent);
}

.generation-errors p {
  margin: 0;
}

.generation-errors ul {
  margin: 5px 0 0;
  padding-left: 16px;
}

.completed-message {
  color: var(--teal);
}

.preview-pane {
  min-width: 0;
  min-height: calc(100vh - 72px);
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.preview-toolbar {
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 34px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  color: var(--accent);
  font-family: "Avenir Next Condensed", sans-serif;
  font-size: 9px;
  font-weight: 800;
}

.preview-toolbar h2 {
  margin: 5px 0 0;
  font-size: 17px;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-controls button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: transparent;
  cursor: pointer;
}

.page-controls button:disabled {
  color: #b9b6af;
  cursor: default;
}

.page-controls span {
  min-width: 50px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.page-stage {
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: auto;
  padding: 28px;
}

.paper {
  width: min(72vh, 620px, 86%);
  aspect-ratio: 210 / 297;
  position: relative;
  background: var(--paper);
  box-shadow: 0 18px 48px rgba(43, 39, 30, 0.13), 0 1px 4px rgba(43, 39, 30, 0.12);
}

.card-slot {
  box-sizing: border-box;
  position: absolute;
  overflow: hidden;
  border: 1px solid #c7c3bb;
  background: #eeece6;
}

.card-slot.empty {
  border-style: dashed;
  opacity: 0.42;
}

.card-slot img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
}

.card-slot.rotated img {
  width: 68.6047%;
  height: 145.7627%;
  position: absolute;
  top: -22.8814%;
  left: 15.6977%;
  transform: rotate(90deg);
}

.card-slot > .slot-label {
  max-width: calc(100% - 8px);
  position: absolute;
  left: 4px;
  bottom: 4px;
  overflow: hidden;
  padding: 2px 4px;
  color: white;
  background: rgba(20, 20, 18, 0.78);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 7px;
  text-overflow: ellipsis;
}

.preview-footer {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 22px;
  padding: 0 34px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.visually-hidden {
  width: 1px;
  height: 1px;
  position: absolute;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .app-bar {
    grid-template-columns: 1fr auto;
    padding: 0 18px;
  }

  .brand {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
  }

  .back-link {
    grid-column: 2;
    grid-row: 1;
  }

  .header-status {
    display: none;
  }

  .workspace {
    display: block;
  }

  .control-pane {
    border-right: 0;
  }

  .preview-pane {
    min-height: 760px;
    border-top: 1px solid var(--line);
  }

  .paper {
    width: min(620px, 96%);
  }
}

@media (max-width: 520px) {
  .app-bar {
    height: 64px;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
  }

  .brand h1 {
    font-size: 17px;
  }

  .brand p,
  .back-link span {
    display: none;
  }

  .control-section,
  .generate-area {
    padding-right: 18px;
    padding-left: 18px;
  }

  .section-selectors {
    gap: 5px;
  }

  .section-check {
    padding: 9px 7px;
  }

  .preview-toolbar,
  .preview-footer {
    padding-right: 18px;
    padding-left: 18px;
  }

  .page-stage {
    padding: 18px 10px;
  }
}
</style>
