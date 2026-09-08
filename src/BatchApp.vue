<template>
  <div class="batch-app">
    <header class="batch-header">
      <a class="batch-brand" href="../">
        <span>YG</span>
        <div>
          <strong>批量制卡</strong>
          <small>CARD PRODUCTION</small>
        </div>
      </a>
      <nav aria-label="工作台导航">
        <a href="../editor/">单卡DIY工坊</a>
        <a href="../library/">卡片资料库</a>
        <a href="../print/">卡组打印工作台</a>
      </nav>
      <div class="batch-count">{{ cards.length }} / 200</div>
    </header>

    <ProjectBar
      :project-id="activeProjectId"
      :name="projectName"
      name-placeholder="批量制卡方案名称"
      entity-label="批量制卡方案"
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

    <main class="batch-workspace">
      <aside class="batch-source">
        <section>
          <div class="section-title">
            <span>01</span>
            <h1>导入卡片数据</h1>
            <button type="button" @click="loadSample">示例</button>
          </div>
          <div class="source-actions">
            <button type="button" @click="dataFileInput?.click()">
              <Icon icon="ri:file-upload-line" />
              <span>选择 CSV / JSON</span>
            </button>
            <button type="button" title="粘贴" @click="pasteSource">
              <Icon icon="ri:clipboard-line" />
            </button>
          </div>
          <input
            ref="dataFileInput"
            class="visually-hidden"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            @change="onDataFile"
          >
          <textarea
            v-model="sourceText"
            aria-label="批量卡片 CSV 或 JSON"
            spellcheck="false"
            placeholder="name,password,type,cardType,..."
          />
          <button
            class="parse-command"
            type="button"
            :disabled="!sourceText.trim()"
            @click="parseSource"
          >
            <Icon icon="ri:table-line" />
            <span>载入工作区</span>
          </button>
          <p v-if="sourceError" class="status-message error">{{ sourceError }}</p>
          <p v-else-if="notice" class="status-message">{{ notice }}</p>
        </section>

        <section class="batch-list-section">
          <div class="section-title">
            <span>02</span>
            <h2>卡片队列</h2>
            <button type="button" title="新增卡片" @click="addCard">
              <Icon icon="ri:add-line" />
            </button>
          </div>
          <template v-if="cards.length">
            <div class="batch-production-toolbar">
              <span>{{ selectedCards.length }} 张已选</span>
              <button type="button" title="全选" @click="selectAllCards">
                <Icon icon="ri:checkbox-multiple-line" />
              </button>
              <button type="button" title="清除选择" @click="clearCardSelection">
                <Icon icon="ri:checkbox-blank-line" />
              </button>
              <button
                type="button"
                title="批量匹配官方资料"
                :disabled="isMatching"
                @click="matchSelectedCards"
              >
                <Icon :icon="isMatching ? 'ri:loader-4-line' : 'ri:database-2-line'" :class="{ spinning: isMatching }" />
              </button>
              <button
                type="button"
                title="按文件名匹配多张卡图"
                @click="artworkFilesInput?.click()"
              >
                <Icon icon="ri:image-add-line" />
              </button>
              <button type="button" title="复制所选卡片" @click="duplicateSelectedCards">
                <Icon icon="ri:file-copy-line" />
              </button>
              <button type="button" title="删除所选卡片" @click="removeSelectedCards">
                <Icon icon="ri:delete-bin-line" />
              </button>
              <button type="button" title="导出 CSV" @click="exportBatchData('csv')">
                <Icon icon="ri:file-excel-2-line" />
              </button>
              <button type="button" title="导出 JSON" @click="exportBatchData('json')">
                <Icon icon="ri:braces-line" />
              </button>
              <input
                ref="artworkFilesInput"
                class="visually-hidden"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                @change="onArtworkFiles"
              >
            </div>
            <div class="batch-bulk-row">
              <select v-model="bulkField" aria-label="批量字段">
                <option value="language">语言</option>
                <option value="rare">罕贵</option>
                <option value="copyright">版权</option>
                <option value="font">字体</option>
                <option value="radius">圆角</option>
              </select>
              <select v-model="bulkValue" aria-label="批量字段值">
                <option
                  v-for="option in bulkValueOptions"
                  :key="String(option[0])"
                  :value="option[0]"
                >
                  {{ option[1] }}
                </option>
              </select>
              <button type="button" @click="applyBulkValue">应用</button>
              <select v-model="matchMode" aria-label="资料匹配方式">
                <option value="refresh">更新资料</option>
                <option value="missing">仅补空值</option>
              </select>
              <button
                class="copy-style-command"
                type="button"
                title="将当前卡片样式应用到所选卡片"
                :disabled="!selectedCard || !selectedCards.length"
                @click="applyCurrentStyle"
              >
                <Icon icon="ri:paint-brush-line" />
              </button>
            </div>
            <p v-if="isMatching" class="batch-operation-status">
              匹配 {{ matchProgress.done }} / {{ matchProgress.total }}
            </p>
            <div class="batch-quality-toolbar">
              <div class="batch-quality-filters" aria-label="质量状态筛选">
                <button
                  v-for="filter in qualityFilters"
                  :key="filter.id"
                  type="button"
                  :class="{ active: qualityFilter === filter.id }"
                  @click="qualityFilter = filter.id"
                >
                  <span>{{ filter.label }}</span>
                  <strong>{{ filter.count }}</strong>
                </button>
              </div>
              <button
                class="next-issue-command"
                type="button"
                title="定位下一张待处理卡片"
                :disabled="!batchAudit.issues"
                @click="focusNextIssue"
              >
                <Icon icon="ri:focus-3-line" />
              </button>
            </div>
            <div v-if="filteredCards.length" class="batch-list">
              <article
                v-for="{ card, index, quality } in filteredCards"
                :key="card.batchId"
                :class="{
                  active: selectedIndex === index,
                  selected: selectedBatchIds.has(card.batchId),
                  dragging: draggedBatchId === card.batchId,
                }"
                draggable="true"
                @dragstart="startCardDrag(card.batchId)"
                @dragend="draggedBatchId = ''"
                @dragover.prevent
                @drop.prevent="dropCardBefore(card.batchId)"
              >
                <label class="batch-select">
                  <input
                    type="checkbox"
                    :checked="selectedBatchIds.has(card.batchId)"
                    :aria-label="`选择 ${card.name}`"
                    @click.stop="toggleCardSelection(card, index, $event)"
                  >
                </label>
                <button
                  type="button"
                  class="batch-card-row"
                  @click="selectedIndex = index"
                >
                  <span class="sequence">{{ String(index + 1).padStart(2, '0') }}</span>
                  <span class="identity">
                    <strong>{{ card.name }}</strong>
                    <small>{{ card.password || '无密码' }}</small>
                  </span>
                  <span class="type-mark">{{ cardTypeLabel(card) }}</span>
                  <span
                    class="quality-mark"
                    :class="quality.status"
                    :title="quality.issues.map(issue => issue.message).join('；')
                      || '可生产'"
                  >
                    <Icon :icon="qualityIcon(quality.status)" />
                    <small>{{ quality.issues.length }}</small>
                  </span>
                </button>
              </article>
            </div>
            <div v-else class="empty-filtered-queue">
              当前筛选下没有卡片
            </div>
          </template>
          <div v-else class="empty-queue">
            <Icon icon="ri:file-list-3-line" />
            <span>暂无卡片</span>
          </div>
        </section>
      </aside>

      <section class="batch-editor">
        <template v-if="selectedCard">
          <div class="editor-heading">
            <div>
              <span class="eyebrow">CARD {{ String(selectedIndex + 1).padStart(2, '0') }}</span>
              <h2>{{ selectedCard.name }}</h2>
            </div>
            <div class="editor-actions">
              <button
                type="button"
                title="在单卡DIY工坊中精修"
                @click="openSelectedInEditor"
              >
                <Icon icon="ri:edit-box-line" />
              </button>
              <button type="button" title="复制卡片" @click="duplicateCard">
                <Icon icon="ri:file-copy-line" />
              </button>
              <button
                class="danger"
                type="button"
                title="删除卡片"
                @click="removeCard"
              >
                <Icon icon="ri:delete-bin-line" />
              </button>
            </div>
          </div>
          <div
            class="selected-card-quality"
            :class="selectedQuality.status"
          >
            <Icon :icon="qualityIcon(selectedQuality.status)" />
            <strong>{{ qualityLabel(selectedQuality.status) }}</strong>
            <span v-if="selectedQuality.issues.length">
              {{ selectedQuality.issues
                .map(issue => issue.message)
                .join(' · ') }}
            </span>
            <span v-else>资料完整，可以进入生产流程</span>
          </div>

          <div class="editor-grid">
            <label class="field field-wide">
              <span>卡片名称</span>
              <input v-model="selectedCard.name" type="text">
            </label>
            <label class="field">
              <span>卡片密码</span>
              <input v-model="selectedCard.password" type="text">
            </label>
            <label class="field">
              <span>语言</span>
              <select v-model="selectedCard.language">
                <option value="sc">简体中文</option>
                <option value="tc">繁体中文</option>
                <option value="jp">日文</option>
                <option value="kr">韩文</option>
                <option value="en">英文</option>
              </select>
            </label>
            <label class="field">
              <span>卡片类别</span>
              <select v-model="selectedCard.type">
                <option value="monster">怪兽</option>
                <option value="pendulum">灵摆</option>
                <option value="spell">魔法</option>
                <option value="trap">陷阱</option>
              </select>
            </label>
            <label v-if="isMonster" class="field">
              <span>怪兽类型</span>
              <select v-model="selectedCard.cardType">
                <option value="normal">通常</option>
                <option value="effect">效果</option>
                <option value="ritual">仪式</option>
                <option value="fusion">融合</option>
                <option value="synchro">同调</option>
                <option value="xyz">超量</option>
                <option value="link">连接</option>
                <option value="token">衍生物</option>
              </select>
            </label>
            <label v-if="isMonster" class="field">
              <span>属性</span>
              <select v-model="selectedCard.attribute">
                <option value="dark">暗</option>
                <option value="light">光</option>
                <option value="earth">地</option>
                <option value="water">水</option>
                <option value="fire">炎</option>
                <option value="wind">风</option>
                <option value="divine">神</option>
              </select>
            </label>
            <label v-if="!isMonster" class="field">
              <span>魔陷标识</span>
              <select v-model="selectedCard.icon">
                <option value="">无</option>
                <option value="continuous">永续</option>
                <option value="equip">装备</option>
                <option value="field">场地</option>
                <option value="quick-play">速攻</option>
                <option value="ritual">仪式</option>
                <option value="counter">反击</option>
              </select>
            </label>
            <label v-if="isMonster" class="field field-wide">
              <span>种族 / 分类</span>
              <input v-model="selectedCard.monsterType" type="text">
            </label>
            <label v-if="showLevel" class="field compact">
              <span>{{ selectedCard.cardType === 'xyz' ? '阶级' : '等级' }}</span>
              <input
                v-if="selectedCard.cardType === 'xyz'"
                v-model.number="selectedCard.rank"
                type="number"
                min="0"
                max="13"
              >
              <input
                v-else
                v-model.number="selectedCard.level"
                type="number"
                min="0"
                max="13"
              >
            </label>
            <label v-if="isMonster" class="field compact">
              <span>ATK</span>
              <input v-model.number="selectedCard.atk" type="number">
            </label>
            <label v-if="isMonster && selectedCard.cardType !== 'link'" class="field compact">
              <span>DEF</span>
              <input v-model.number="selectedCard.def" type="number">
            </label>
            <label class="field field-wide">
              <span>卡图地址</span>
              <span class="image-field">
                <input v-model="selectedCard.image" type="url" placeholder="https://">
                <button type="button" title="上传卡图" @click="artFileInput?.click()">
                  <Icon icon="ri:image-add-line" />
                </button>
              </span>
            </label>
            <input
              ref="artFileInput"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="onArtworkFile"
            >
            <label
              v-if="selectedCard.type === 'pendulum'"
              class="field field-wide text-field"
            >
              <span>灵摆效果</span>
              <textarea v-model="selectedCard.pendulumDescription" />
            </label>
            <label class="field field-wide text-field">
              <span>效果文本</span>
              <textarea v-model="selectedCard.description" />
            </label>
          </div>
        </template>
        <div v-else class="empty-editor">
          <Icon icon="ri:stack-line" />
          <span>导入数据或新增卡片</span>
        </div>
      </section>

      <aside class="batch-output">
        <div class="preview-heading">
          <div>
            <span class="eyebrow">RENDER PREVIEW</span>
            <h2>高清卡面</h2>
          </div>
          <span :class="{ error: previewError }">
            {{ previewError || (isPreviewing ? '渲染中' : 'PNG') }}
          </span>
        </div>
        <div class="batch-preview">
          <img v-if="previewUrl" :src="previewUrl" :alt="selectedCard?.name || '卡片预览'">
          <Icon v-else :class="{ spinning: isPreviewing }" icon="ri:loader-4-line" />
        </div>

        <div v-if="isRendering" class="render-progress">
          <div>
            <span>渲染 {{ renderProgress.done }} / {{ renderProgress.total }}</span>
            <strong>{{ progressPercent }}%</strong>
          </div>
          <span><i :style="{ width: `${progressPercent}%` }" /></span>
        </div>

        <div class="output-actions">
          <p class="production-scope">
            {{ selectedCards.length
              ? `当前仅生产所选 ${selectedCards.length} 张`
              : `当前生产全部 ${cards.length} 张` }}
          </p>
          <button
            type="button"
            :disabled="!selectedCard || isRendering"
            @click="addSelectedToDeck"
          >
            <Icon icon="ri:add-box-line" />
            <span>加入当前卡组</span>
          </button>
          <button
            type="button"
            :disabled="!cards.length || isRendering"
            @click="addAllToDeck"
          >
            <Icon icon="ri:stack-line" />
            <span>全部加入卡组</span>
          </button>
          <button
            type="button"
            :disabled="!productionCards.length || isRendering"
            @click="sendToPrint"
          >
            <Icon icon="ri:printer-line" />
            <span>送往卡组打印工作台</span>
          </button>
          <button
            type="button"
            :disabled="!selectedCard || isRendering"
            @click="downloadCurrent"
          >
            <Icon icon="ri:image-line" />
            <span>下载当前 PNG</span>
          </button>
          <button
            class="primary"
            type="button"
            :disabled="!cards.length || isRendering"
            @click="downloadAll"
          >
            <Icon :icon="isRendering ? 'ri:loader-4-line' : 'ri:file-zip-line'" :class="{ spinning: isRendering }" />
            <span>{{ isRendering
              ? '正在生成'
              : selectedCards.length
                ? `导出所选 ${selectedCards.length} 张 PNG`
                : '导出全部 PNG' }}</span>
          </button>
          <button
            class="primary"
            type="button"
            :disabled="!productionCards.length || isRendering"
            @click="downloadDeliveryPackage"
          >
            <Icon icon="ri:archive-line" />
            <span>导出生产包</span>
          </button>
        </div>
        <p v-if="renderErrors.length" class="render-errors">
          {{ renderErrors.length }} 张失败：{{ renderErrors.slice(0, 3).map(item => item.name).join('、') }}
        </p>
      </aside>
    </main>
    <ImageCropper
      v-if="cropSource"
      :source="cropSource"
      @apply="applyCroppedArtwork"
      @cancel="cropSource = ''"
    />
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import ImageCropper from '@/components/ImageCropper.vue';
import ProjectBar from '@/components/ProjectBar.vue';
import {
  createBatchDeliveryZip,
  createBatchZip,
  dataUrlToBlob,
  downloadBlob,
  sanitizeFilename,
  serializeBatchCsv,
  serializeBatchJson,
} from '@/features/batch/batch-export';
import {
  BATCH_CARD_DEFAULTS,
  BATCH_CSV_SAMPLE,
  parseBatchCards,
} from '@/features/batch/batch-parser';
import {
  createBatchCard,
  createBatchId,
} from '@/features/batch/batch-project';
import {
  auditBatchCards,
  getBatchCardQuality,
} from '@/features/batch/batch-validation';
import { resolveSearchResult } from '@/features/cards/card-service';
import {
  addCustomCardsToDeck,
  createCustomCard,
} from '@/features/cards/custom-card';
import {
  getCardArtworkId,
  searchCardDatabase,
} from '@/features/print/card-source';
import { runWithConcurrency } from '@/features/print/concurrency';
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
} from '@/features/projects/project-store';

const clone = value => JSON.parse(JSON.stringify(value));
const hydrateCards = values => values.map(card => ({
  ...clone(BATCH_CARD_DEFAULTS),
  ...clone(card),
  batchId: card.batchId || createBatchId(),
}));

const dataFileInput = ref(null);
const artFileInput = ref(null);
const artworkFilesInput = ref(null);
const sourceText = ref('');
const sourceError = ref('');
const notice = ref('');
const cards = ref([]);
const selectedIndex = ref(-1);
const projects = ref([]);
const activeProjectId = ref('');
const activeProjectRevision = ref(0);
const projectName = ref('未命名批量制卡方案');
const previewUrl = ref('');
const previewError = ref('');
const cropSource = ref('');
const isPreviewing = ref(false);
const isRendering = ref(false);
const renderErrors = ref([]);
const renderProgress = reactive({ done: 0, total: 0 });
const renderedCache = new Map();
const selectedBatchIds = ref(new Set());
const draggedBatchId = ref('');
const bulkField = ref('language');
const bulkValue = ref('sc');
const matchMode = ref('refresh');
const qualityFilter = ref('all');
const isMatching = ref(false);
const matchProgress = reactive({ done: 0, total: 0 });
let lastSelectedIndex = -1;
let loadingProject = false;
let projectSaveTimer;
let previewTimer;
let previewRequest = 0;

const selectedCard = computed(() => cards.value[selectedIndex.value] || null);
const selectedCards = computed(() => cards.value.filter(card =>
  selectedBatchIds.value.has(card.batchId)));
const batchAudit = computed(() => auditBatchCards(cards.value));
const qualityById = computed(() => new Map(
  batchAudit.value.items.map(item => [item.batchId, item]),
));
const filteredCards = computed(() => cards.value
  .map((card, index) => ({
    card,
    index,
    quality: qualityById.value.get(card.batchId),
  }))
  .filter(item =>
    qualityFilter.value === 'all' ||
    item.quality.status === qualityFilter.value));
const selectedQuality = computed(() =>
  selectedCard.value
    ? getBatchCardQuality(selectedCard.value, cards.value)
    : {
      issues: [],
      errors: 0,
      warnings: 0,
      status: 'ready',
    });
const productionCards = computed(() =>
  selectedCards.value.length ? selectedCards.value : cards.value);
const qualityFilters = computed(() => [
  { id: 'all', label: '全部', count: cards.value.length },
  { id: 'ready', label: '可生产', count: batchAudit.value.ready },
  { id: 'attention', label: '待补充', count: batchAudit.value.attention },
  { id: 'blocked', label: '阻断', count: batchAudit.value.blocked },
]);
const bulkValueOptions = computed(() => ({
  language: [
    ['sc', '简体中文'],
    ['tc', '繁体中文'],
    ['jp', '日文'],
    ['kr', '韩文'],
    ['en', '英文'],
  ],
  rare: [
    ['', '无'],
    ['ur', '金字 UR'],
    ['ser', '银碎 SER'],
    ['gser', '金碎 GSER'],
    ['pser', '红碎 PSER'],
  ],
  copyright: [
    ['', '无'],
    ['sc', '简体中文'],
    ['jp', '日文'],
    ['en', '英文'],
  ],
  font: [
    ['', '默认'],
    ['custom1', '自定义一'],
    ['custom2', '自定义二'],
  ],
  radius: [
    [true, '开启'],
    [false, '关闭'],
  ],
}[bulkField.value] || []));
const isMonster = computed(() =>
  ['monster', 'pendulum'].includes(selectedCard.value?.type));
const showLevel = computed(() =>
  isMonster.value && selectedCard.value?.cardType !== 'link');
const progressPercent = computed(() => {
  if (!renderProgress.total) return 0;
  return Math.round(renderProgress.done / renderProgress.total * 100);
});

const STYLE_FIELDS = [
  'language',
  'font',
  'color',
  'align',
  'gradient',
  'gradientColor1',
  'gradientColor2',
  'descriptionAlign',
  'descriptionZoom',
  'descriptionWeight',
  'copyright',
  'laser',
  'rare',
  'twentieth',
  'radius',
  'scale',
];

const qualityIcon = status => ({
  ready: 'ri:check-line',
  attention: 'ri:error-warning-line',
  blocked: 'ri:close-line',
}[status] || 'ri:question-line');

const qualityLabel = status => ({
  ready: '可生产',
  attention: '建议补充',
  blocked: '存在阻断项',
}[status] || '待检查');

const cardTypeLabel = card => {
  if (card.type === 'spell') return '魔法';
  if (card.type === 'trap') return '陷阱';
  const labels = {
    normal: '通常',
    effect: '效果',
    ritual: '仪式',
    fusion: '融合',
    synchro: '同调',
    xyz: '超量',
    link: '连接',
    token: '衍生物',
  };
  return labels[card.cardType] || '怪兽';
};

const replaceSelection = values => {
  selectedBatchIds.value = new Set(values);
};

const toggleCardSelection = (card, index, event) => {
  const next = new Set(selectedBatchIds.value);
  if (event.shiftKey && lastSelectedIndex >= 0) {
    const start = Math.min(lastSelectedIndex, index);
    const end = Math.max(lastSelectedIndex, index);
    cards.value.slice(start, end + 1).forEach(item => next.add(item.batchId));
  } else if (event.currentTarget.checked) {
    next.add(card.batchId);
  } else {
    next.delete(card.batchId);
  }
  selectedIndex.value = index;
  lastSelectedIndex = index;
  replaceSelection(next);
};

const selectAllCards = () => {
  replaceSelection(cards.value.map(card => card.batchId));
};

const clearCardSelection = () => {
  replaceSelection([]);
  lastSelectedIndex = -1;
};

const getOperationCards = () => {
  if (selectedCards.value.length) return selectedCards.value;
  return selectedCard.value ? [selectedCard.value] : [];
};

const applyCurrentStyle = () => {
  if (!selectedCard.value || !selectedCards.value.length) return;
  const style = Object.fromEntries(
    STYLE_FIELDS.map(field => [
      field,
      clone(selectedCard.value[field]),
    ]),
  );
  selectedCards.value.forEach(card => {
    Object.assign(card, clone(style));
    renderedCache.delete(card.batchId);
  });
  notice.value = `已将当前样式应用到 ${selectedCards.value.length} 张卡片`;
};

const focusNextIssue = () => {
  const issueIndexes = cards.value
    .map((card, index) => ({
      index,
      quality: qualityById.value.get(card.batchId),
    }))
    .filter(item => item.quality?.issues.length)
    .map(item => item.index);
  if (!issueIndexes.length) return;
  const nextIndex = issueIndexes.find(index => index > selectedIndex.value) ??
    issueIndexes[0];
  selectedIndex.value = nextIndex;
  qualityFilter.value = 'all';
  requestAnimationFrame(() => {
    document.querySelector(
      `.batch-list article:nth-child(${nextIndex + 1})`,
    )?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  });
};

const applyBulkValue = () => {
  const targets = getOperationCards();
  if (!targets.length) return;
  targets.forEach(card => {
    card[bulkField.value] = bulkValue.value;
    renderedCache.delete(card.batchId);
  });
  notice.value = `已批量更新 ${targets.length} 张卡片`;
};

const duplicateSelectedCards = () => {
  const targets = getOperationCards();
  const available = 200 - cards.value.length;
  if (!targets.length || available <= 0) return;
  const duplicated = targets.slice(0, available).map(card => createBatchCard({
    ...clone(card),
    name: `${card.name} 副本`,
    batchId: '',
  }));
  cards.value.push(...duplicated);
  replaceSelection(duplicated.map(card => card.batchId));
  selectedIndex.value = cards.value.length - duplicated.length;
  notice.value = `已复制 ${duplicated.length} 张卡片`;
};

const removeSelectedCards = () => {
  const targets = getOperationCards();
  if (!targets.length) return;
  const ids = new Set(targets.map(card => card.batchId));
  ids.forEach(id => renderedCache.delete(id));
  cards.value = cards.value.filter(card => !ids.has(card.batchId));
  clearCardSelection();
  selectedIndex.value = cards.value.length
    ? Math.min(selectedIndex.value, cards.value.length - 1)
    : -1;
  notice.value = `已删除 ${targets.length} 张卡片`;
};

const startCardDrag = cardId => {
  draggedBatchId.value = cardId;
};

const dropCardBefore = targetId => {
  const sourceId = draggedBatchId.value;
  draggedBatchId.value = '';
  if (!sourceId || sourceId === targetId) return;
  const sourceIndex = cards.value.findIndex(card => card.batchId === sourceId);
  const targetIndex = cards.value.findIndex(card => card.batchId === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = cards.value.splice(sourceIndex, 1);
  cards.value.splice(
    sourceIndex < targetIndex ? targetIndex - 1 : targetIndex,
    0,
    moved,
  );
  selectedIndex.value = cards.value.findIndex(card => card.batchId === sourceId);
};

const normalizeArtworkKey = value => String(value || '')
  .replace(/\.[^.]+$/, '')
  .trim()
  .toLowerCase()
  .replace(/^0+(?=\d)/, '')
  .replace(/[\s_\-()[\]【】]+/g, '');

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error('卡图文件读取失败'));
  reader.readAsDataURL(file);
});

const onArtworkFiles = async event => {
  const files = [...(event.target.files || [])];
  event.target.value = '';
  if (!files.length) return;
  const cardMap = new Map();
  cards.value.forEach(card => {
    [
      card.password,
      String(card.password || '').replace(/^0+/, ''),
      card.name,
      card.sourceCardId,
    ].forEach(value => {
      const key = normalizeArtworkKey(value);
      if (key && !cardMap.has(key)) cardMap.set(key, card);
    });
  });
  let matched = 0;
  for (const file of files) {
    const card = cardMap.get(normalizeArtworkKey(file.name));
    if (!card) continue;
    card.image = await readFileAsDataUrl(file);
    renderedCache.delete(card.batchId);
    matched += 1;
  }
  notice.value = `已按文件名匹配 ${matched} / ${files.length} 张卡图`;
};

const findDatabaseMatch = async card => {
  const query = String(card.password || card.name || '').trim();
  if (!query) throw new Error('缺少卡名或密码');
  const results = await searchCardDatabase(query);
  const normalized = query.replace(/^0+/, '') || '0';
  const result = /^\d+$/.test(query)
    ? results.find(item =>
      getCardArtworkId(item) === normalized ||
      String(item.id) === normalized)
    : results.find(item =>
      [item.sc_name, item.cn_name, item.md_name, item.jp_name, item.en_name]
        .some(name => String(name || '').trim() === query)) || results[0];
  if (!result) throw new Error(`未找到“${query}”`);
  return resolveSearchResult(result, { includeArtwork: true });
};

const mergeMatchedCard = (card, resolved) => {
  const identity = {
    batchId: card.batchId,
    sourceCardId: resolved.artworkId,
  };
  if (matchMode.value === 'missing') {
    const merged = { ...card };
    Object.entries(resolved.rendererData).forEach(([key, value]) => {
      if (merged[key] === '' || merged[key] === null ||
        merged[key] === undefined) {
        merged[key] = value;
      }
    });
    return { ...merged, ...identity };
  }
  const style = Object.fromEntries(
    STYLE_FIELDS
      .filter(key => Object.hasOwn(card, key))
      .map(key => [key, card[key]]),
  );
  return {
    ...card,
    ...resolved.rendererData,
    ...style,
    ...identity,
  };
};

const matchSelectedCards = async () => {
  const targets = getOperationCards();
  if (!targets.length || isMatching.value) return;
  isMatching.value = true;
  sourceError.value = '';
  matchProgress.done = 0;
  matchProgress.total = targets.length;
  const errors = [];
  const tasks = targets.map(card => async () => {
    try {
      const resolved = await findDatabaseMatch(card);
      const index = cards.value.findIndex(item => item.batchId === card.batchId);
      if (index >= 0) {
        cards.value[index] = mergeMatchedCard(cards.value[index], resolved);
        renderedCache.delete(card.batchId);
      }
    } catch (error) {
      errors.push(`${card.name}：${
        error instanceof Error ? error.message : String(error)
      }`);
    } finally {
      matchProgress.done += 1;
    }
  });
  await runWithConcurrency(tasks, 3);
  isMatching.value = false;
  notice.value = `已匹配 ${targets.length - errors.length} / ${targets.length} 张卡片`;
  if (errors.length) sourceError.value = errors.slice(0, 3).join('；');
};

const exportBatchData = format => {
  const targets = productionCards.value;
  if (!targets.length) return;
  const content = format === 'csv'
    ? serializeBatchCsv(targets)
    : serializeBatchJson(targets);
  downloadBlob(
    new Blob([content], {
      type: format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/json;charset=utf-8',
    }),
    `${sanitizeFilename(projectName.value)}.${format}`,
  );
  notice.value = `已导出 ${targets.length} 张卡片数据`;
};

const parseSource = () => {
  sourceError.value = '';
  try {
    cards.value = hydrateCards(parseBatchCards(sourceText.value));
    selectedIndex.value = 0;
    clearCardSelection();
    renderedCache.clear();
    notice.value = `已载入 ${cards.value.length} 张卡片`;
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : String(error);
  }
};

const loadSample = () => {
  sourceText.value = BATCH_CSV_SAMPLE;
  projectName.value = '原创卡示例';
  parseSource();
};

const pasteSource = async () => {
  try {
    sourceText.value = await navigator.clipboard.readText();
    sourceError.value = '';
  } catch {
    sourceError.value = '无法读取剪贴板，请直接粘贴到输入框';
  }
};

const onDataFile = async event => {
  const file = event.target.files?.[0];
  if (file) {
    sourceText.value = await file.text();
    projectName.value = file.name.replace(/\.(csv|json)$/i, '') ||
      '未命名批量制卡方案';
    parseSource();
  }
  event.target.value = '';
};

const addCard = () => {
  if (cards.value.length >= 200) {
    sourceError.value = '单个批量制卡方案最多包含 200 张原创卡';
    return;
  }
  cards.value.push({
    ...clone(BATCH_CARD_DEFAULTS),
    name: `未命名卡片 ${cards.value.length + 1}`,
    password: '',
    image: '',
    batchId: createBatchId(),
  });
  selectedIndex.value = cards.value.length - 1;
};

const duplicateCard = () => {
  if (!selectedCard.value) return;
  if (cards.value.length >= 200) {
    sourceError.value = '单个批量制卡方案最多包含 200 张原创卡';
    return;
  }
  const duplicated = {
    ...clone(selectedCard.value),
    name: `${selectedCard.value.name} 副本`,
    batchId: createBatchId(),
  };
  cards.value.splice(selectedIndex.value + 1, 0, duplicated);
  selectedIndex.value += 1;
};

const removeCard = () => {
  if (!selectedCard.value) return;
  renderedCache.delete(selectedCard.value.batchId);
  cards.value.splice(selectedIndex.value, 1);
  selectedIndex.value = cards.value.length
    ? Math.min(selectedIndex.value, cards.value.length - 1)
    : -1;
};

const onArtworkFile = event => {
  const file = event.target.files?.[0];
  if (!file || !selectedCard.value) return;
  const reader = new FileReader();
  reader.onload = () => {
    cropSource.value = String(reader.result);
  };
  reader.onerror = () => {
    previewError.value = '卡图文件读取失败';
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

const applyCroppedArtwork = dataUrl => {
  if (selectedCard.value) {
    selectedCard.value.image = dataUrl;
  }
  cropSource.value = '';
};

const renderCard = async card => {
  const { renderYugiohCardData } = await import(
    '@/features/print/render-card'
  );
  const dataUrl = await renderYugiohCardData(card, { format: 'png' });
  renderedCache.set(card.batchId, dataUrl);
  return dataUrl;
};

const renderPreview = async () => {
  const card = selectedCard.value;
  const request = ++previewRequest;
  if (!card) {
    previewUrl.value = '';
    return;
  }
  const cached = renderedCache.get(card.batchId);
  if (cached) {
    previewUrl.value = cached;
    previewError.value = '';
    return;
  }
  previewUrl.value = '';
  isPreviewing.value = true;
  previewError.value = '';
  try {
    const dataUrl = await renderCard(clone(card));
    if (request === previewRequest) {
      previewUrl.value = dataUrl;
    }
  } catch (error) {
    if (request === previewRequest) {
      previewUrl.value = '';
      previewError.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (request === previewRequest) {
      isPreviewing.value = false;
    }
  }
};

const schedulePreview = () => {
  clearTimeout(previewTimer);
  const card = selectedCard.value;
  if (card) {
    renderedCache.delete(card.batchId);
  }
  previewTimer = setTimeout(renderPreview, 420);
};

watch(selectedCard, (card, previousCard) => {
  if (card?.batchId !== previousCard?.batchId) {
    clearTimeout(previewTimer);
    renderPreview();
    return;
  }
  schedulePreview();
}, { deep: true });

watch(
  () => [selectedCard.value?.type, selectedCard.value?.cardType],
  ([type, cardType]) => {
    if (!selectedCard.value) return;
    selectedCard.value.pendulumType = `${cardType || 'effect'}-pendulum`;
    selectedCard.value.firstLineCompress =
      ['monster', 'pendulum'].includes(type) &&
      ['fusion', 'synchro', 'xyz', 'link'].includes(cardType);
  },
);

watch(bulkField, () => {
  bulkValue.value = bulkValueOptions.value[0]?.[0] ?? '';
});

const downloadCurrent = async () => {
  const card = selectedCard.value;
  if (!card) return;
  previewError.value = '';
  try {
    const dataUrl = renderedCache.get(card.batchId) ||
      await renderCard(clone(card));
    previewUrl.value = dataUrl;
    downloadBlob(
      dataUrlToBlob(dataUrl),
      `${sanitizeFilename([card.password, card.name].filter(Boolean).join('-'))}.png`,
    );
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error);
  }
};

const downloadAll = async () => {
  const targets = [...productionCards.value];
  if (!targets.length || isRendering.value) return;
  isRendering.value = true;
  renderErrors.value = [];
  renderProgress.done = 0;
  renderProgress.total = targets.length;
  const output = [];
  try {
    for (const card of targets) {
      try {
        const dataUrl = renderedCache.get(card.batchId) ||
          await renderCard(clone(card));
        output.push({
          name: card.name,
          password: card.password,
          dataUrl,
        });
      } catch (error) {
        renderErrors.value.push({
          name: card.name,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        renderProgress.done += 1;
      }
    }
    if (!output.length) {
      throw new Error('没有可导出的卡图');
    }
    downloadBlob(
      await createBatchZip(output),
      `${sanitizeFilename(projectName.value)}-png.zip`,
    );
    notice.value = `已导出 ${output.length} 张 PNG`;
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isRendering.value = false;
  }
};

const downloadDeliveryPackage = async () => {
  const targets = [...productionCards.value];
  if (!targets.length || isRendering.value) return;
  isRendering.value = true;
  renderErrors.value = [];
  renderProgress.done = 0;
  renderProgress.total = targets.length;
  const output = [];
  try {
    for (const card of targets) {
      try {
        const dataUrl = renderedCache.get(card.batchId) ||
          await renderCard(clone(card));
        output.push({
          ...clone(card),
          dataUrl,
          quality: getBatchCardQuality(card, cards.value),
        });
      } catch (error) {
        renderErrors.value.push({
          name: card.name,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        renderProgress.done += 1;
      }
    }
    if (!output.length) throw new Error('没有可导出的卡图');
    downloadBlob(
      await createBatchDeliveryZip(output),
      `${sanitizeFilename(projectName.value)}-production.zip`,
    );
    notice.value = `生产包已生成：${output.length} 张卡图、清单与源数据`;
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isRendering.value = false;
  }
};

const toCustomCard = card => createCustomCard(card, {
  id: `custom:${card.batchId}`,
  name: card.name,
});

const getActiveDeckProject = async () => {
  const activeId = getActiveProjectId('deck');
  const active = activeId ? await getProject(activeId) : null;
  if ((active?.kind || 'deck') === 'deck' && active?.deck) {
    return active;
  }
  const created = await saveProject({
    kind: 'deck',
    name: '我的原创卡组',
    deck: { main: [], extra: [], side: [] },
    customCards: {},
    settings: {},
    selectedSections: { main: true, extra: true, side: true },
  });
  setActiveProjectId(created.id, 'deck');
  return created;
};

const addCardsToActiveDeck = async sourceCards => {
  if (!sourceCards.length) return null;
  try {
    const project = await getActiveDeckProject();
    const customCardRecords = sourceCards.map(toCustomCard);
    const saved = await saveProject(
      addCustomCardsToDeck(project, customCardRecords),
    );
    setActiveProjectId(saved.id, 'deck');
    notice.value = `${customCardRecords.length} 张原创卡已加入“${saved.name}”`;
    return saved;
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : String(error);
    return null;
  }
};

const addSelectedToDeck = () => {
  if (selectedCard.value) {
    addCardsToActiveDeck([clone(selectedCard.value)]);
  }
};

const addAllToDeck = () => {
  addCardsToActiveDeck(cards.value.map(clone));
};

const sendToPrint = async () => {
  const saved = await addCardsToActiveDeck(
    productionCards.value.map(clone),
  );
  if (saved) {
    location.href = new URL('../print/', location.href).href;
  }
};

const refreshProjects = async () => {
  projects.value = await listProjects('batch');
};

const projectSnapshot = () => ({
  id: activeProjectId.value,
  revision: activeProjectRevision.value,
  kind: 'batch',
  name: projectName.value,
  cards: clone(cards.value),
});

const saveCurrentProject = async () => {
  try {
    const saved = await saveProject(projectSnapshot());
    activeProjectId.value = saved.id;
    activeProjectRevision.value = saved.revision;
    projectName.value = saved.name;
    setActiveProjectId(saved.id, 'batch');
    await refreshProjects();
    notice.value = '批量制卡方案已保存';
    return saved;
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : String(error);
    return null;
  }
};

const openSelectedInEditor = async () => {
  if (!selectedCard.value) return;
  const sourceId = selectedCard.value.batchId;
  const saved = await saveCurrentProject();
  if (!saved) return;
  const url = new URL('../editor/', location.href);
  url.searchParams.set('batchProject', saved.id);
  url.searchParams.set('batchCard', sourceId);
  location.href = url;
};

const duplicateCurrentProject = async () => {
  const saved = await duplicateProject(projectSnapshot());
  await refreshProjects();
  applyProject(saved);
  notice.value = '已创建批量制卡方案副本';
};

const applyProject = project => {
  if (!project || (project.kind || 'deck') !== 'batch') {
    sourceError.value = '请选择批量制卡方案';
    return;
  }
  loadingProject = true;
  activeProjectId.value = project.id;
  activeProjectRevision.value = project.revision || 0;
  projectName.value = project.name;
  cards.value = hydrateCards(project.cards || []);
  selectedIndex.value = cards.value.length ? 0 : -1;
  clearCardSelection();
  renderedCache.clear();
  setActiveProjectId(project.id, 'batch');
  setTimeout(() => {
    loadingProject = false;
  });
};

const selectProject = async id => {
  if (!id) {
    createProject();
    return;
  }
  applyProject(await getProject(id));
};

const createProject = () => {
  loadingProject = true;
  activeProjectId.value = '';
  activeProjectRevision.value = 0;
  projectName.value = '未命名批量制卡方案';
  sourceText.value = '';
  cards.value = [];
  selectedIndex.value = -1;
  clearCardSelection();
  previewUrl.value = '';
  renderedCache.clear();
  setActiveProjectId('', 'batch');
  setTimeout(() => {
    loadingProject = false;
  });
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
  downloadBlob(
    new Blob([serializeProject(projectSnapshot())], {
      type: 'application/json;charset=utf-8',
    }),
    `${sanitizeFilename(projectName.value)}.ygoproject`,
  );
};

const importProjectFile = async file => {
  sourceError.value = '';
  try {
    const imported = parseProject(await file.text());
    if (imported.kind !== 'batch') {
      throw new Error('这个文件不是批量制卡方案备份');
    }
    const saved = await saveProject(imported);
    await refreshProjects();
    applyProject(saved);
    notice.value = '批量制卡方案已导入';
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : String(error);
  }
};

watch(
  () => ({
    id: activeProjectId.value,
    name: projectName.value,
    cards: cards.value,
  }),
  () => {
    if (!activeProjectId.value || loadingProject) return;
    clearTimeout(projectSaveTimer);
    projectSaveTimer = setTimeout(saveCurrentProject, 700);
  },
  { deep: true },
);

onMounted(async () => {
  try {
    await refreshProjects();
    const activeId = getActiveProjectId('batch');
    if (activeId) {
      applyProject(await getProject(activeId));
    }
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : String(error);
  }
});

onBeforeUnmount(() => {
  clearTimeout(projectSaveTimer);
  clearTimeout(previewTimer);
  previewRequest += 1;
});
</script>

<style lang="scss" scoped>
.batch-app {
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

button,
select,
textarea,
input {
  font: inherit;
}

.batch-header {
  height: 64px;
  display: grid;
  grid-template-columns: 220px 1fr 80px;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
}

.batch-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  color: var(--ink);
  text-decoration: none;
}

.batch-brand > span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  font-size: 11px;
  font-weight: 800;
}

.batch-brand strong,
.batch-brand small {
  display: block;
}

.batch-brand strong {
  font-family: "Songti SC", "STSong", serif;
  font-size: 17px;
}

.batch-brand small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 7px;
}

.batch-header nav {
  justify-self: center;
  display: flex;
  gap: 24px;
}

.batch-header nav a {
  color: var(--muted);
  font-size: 11px;
  text-decoration: none;
}

.batch-header nav a:hover {
  color: var(--teal);
}

.batch-count {
  justify-self: end;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.batch-workspace {
  min-height: calc(100vh - 123px);
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(380px, 1fr) minmax(290px, 360px);
}

.batch-source,
.batch-editor {
  border-right: 1px solid var(--line);
}

.batch-source {
  background: #f8f7f3;
}

.batch-source section,
.batch-editor,
.batch-output {
  padding: 24px;
}

.batch-source section + section {
  border-top: 1px solid var(--line);
}

.section-title,
.editor-heading,
.preview-heading {
  display: flex;
  align-items: center;
  gap: 9px;
}

.section-title > span,
.eyebrow {
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
}

.section-title h1,
.section-title h2,
.editor-heading h2,
.preview-heading h2 {
  margin: 0;
}

.section-title h1,
.section-title h2 {
  font-size: 13px;
}

.section-title > button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  margin-left: auto;
  padding: 0;
  border: 0;
  color: var(--teal);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}

.source-actions {
  display: grid;
  grid-template-columns: 1fr 36px;
  gap: 6px;
  margin-top: 16px;
}

.source-actions button,
.parse-command {
  height: 36px;
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

.batch-source textarea {
  width: 100%;
  min-height: 154px;
  margin-top: 7px;
  padding: 10px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 4px;
  outline: 0;
  background: var(--paper);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 9px;
  line-height: 1.55;
}

.batch-source textarea:focus {
  border-color: var(--teal);
}

.parse-command {
  width: 100%;
  margin-top: 7px;
  color: white;
  background: var(--ink);
}

.parse-command:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.status-message,
.render-errors {
  margin: 9px 0 0;
  color: var(--teal);
  font-size: 10px;
  line-height: 1.5;
}

.status-message.error,
.render-errors {
  color: var(--accent);
}

.batch-list-section {
  min-height: 280px;
}

.batch-production-toolbar {
  display: grid;
  grid-template-columns: minmax(62px, 1fr) repeat(8, 28px);
  align-items: center;
  gap: 3px;
  margin-top: 12px;
}

.batch-production-toolbar > span,
.batch-operation-status {
  color: var(--muted);
  font-size: 8px;
  font-variant-numeric: tabular-nums;
}

.batch-production-toolbar button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
}

.batch-production-toolbar button:hover:not(:disabled) {
  border-color: var(--teal);
  color: var(--teal);
}

.batch-bulk-row {
  display: grid;
  grid-template-columns:
    minmax(50px, 0.75fr)
    minmax(64px, 1fr)
    38px
    minmax(68px, 1fr)
    30px;
  gap: 4px;
  margin-top: 6px;
}

.batch-bulk-row select,
.batch-bulk-row button {
  min-width: 0;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: var(--paper);
  font-size: 8px;
}

.batch-bulk-row button {
  cursor: pointer;
}

.batch-bulk-row .copy-style-command {
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--teal);
}

.batch-bulk-row button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.batch-operation-status {
  margin: 7px 0 0;
}

.batch-quality-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 4px;
  margin-top: 8px;
}

.batch-quality-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--line);
  border-radius: 3px;
  overflow: hidden;
}

.batch-quality-filters button {
  min-width: 0;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 4px;
  border: 0;
  border-right: 1px solid var(--line);
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 7px;
}

.batch-quality-filters button:last-child {
  border-right: 0;
}

.batch-quality-filters button.active {
  color: white;
  background: var(--ink);
}

.batch-quality-filters strong {
  font-size: 8px;
}

.next-issue-command {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--accent);
  background: var(--paper);
  cursor: pointer;
}

.next-issue-command:disabled {
  color: var(--muted);
  opacity: 0.45;
  cursor: not-allowed;
}

.batch-list {
  max-height: 430px;
  margin-top: 12px;
  overflow: auto;
  border-top: 1px solid var(--line);
}

.batch-list > article {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: stretch;
  border-bottom: 1px solid var(--line);
}

.batch-list > article:hover,
.batch-list > article.active {
  background: #e9efec;
}

.batch-list > article.active {
  box-shadow: inset 2px 0 var(--teal);
}

.batch-list > article.selected {
  background: #eef3ee;
}

.batch-list > article.dragging {
  opacity: 0.45;
}

.batch-select {
  display: grid;
  place-items: center;
  cursor: pointer;
}

.batch-select input {
  accent-color: var(--teal);
}

.batch-card-row {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 30px;
  align-items: center;
  gap: 8px;
  padding: 9px 6px;
  border: 0;
  border: 0;
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.sequence,
.type-mark,
.identity small {
  color: var(--muted);
  font-size: 8px;
}

.sequence {
  font-family: "SFMono-Regular", Consolas, monospace;
}

.identity {
  min-width: 0;
}

.identity strong,
.identity small {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.identity strong {
  font-size: 10px;
}

.identity small {
  margin-top: 3px;
}

.type-mark {
  padding: 3px 5px;
  border: 1px solid var(--line);
}

.quality-mark {
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
}

.quality-mark small {
  font-size: 7px;
}

.quality-mark.ready {
  border-color: #9fc2ba;
  color: var(--teal);
  background: #edf4f1;
}

.quality-mark.attention {
  border-color: #d8bf7e;
  color: #8a6515;
  background: #fff9e9;
}

.quality-mark.blocked {
  border-color: #d7a69d;
  color: var(--accent);
  background: #fff0ec;
}

.empty-filtered-queue {
  min-height: 88px;
  display: grid;
  place-items: center;
  margin-top: 12px;
  border: 1px dashed var(--line);
  color: var(--muted);
  font-size: 9px;
}

.empty-queue,
.empty-editor {
  min-height: 180px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 10px;
}

.empty-queue svg,
.empty-editor svg {
  font-size: 26px;
}

.batch-editor {
  min-width: 0;
  background: var(--paper);
}

.editor-heading {
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.editor-heading h2 {
  max-width: 34vw;
  margin-top: 4px;
  overflow: hidden;
  font-family: "Songti SC", "STSong", serif;
  font-size: 22px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.editor-actions {
  display: flex;
  gap: 5px;
}

.editor-actions button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.editor-actions button:hover {
  color: var(--teal);
  border-color: var(--teal);
}

.editor-actions button.danger:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.selected-card-quality {
  min-height: 36px;
  display: grid;
  grid-template-columns: 18px auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 9px;
}

.selected-card-quality strong {
  color: var(--ink);
  font-size: 9px;
}

.selected-card-quality span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-card-quality.ready {
  border-color: #a8c7bf;
  color: var(--teal);
  background: #f0f6f3;
}

.selected-card-quality.attention {
  border-color: #dcc88e;
  color: #806018;
  background: #fffaf0;
}

.selected-card-quality.blocked {
  border-color: #dbafa6;
  color: #8a3427;
  background: #fff2ee;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 12px;
  margin-top: 20px;
}

.field {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.field > span:first-child {
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  outline: 0;
  color: var(--ink);
  background: white;
}

.field input,
.field select {
  height: 36px;
  padding: 0 9px;
  font-size: 11px;
}

.field textarea {
  min-height: 92px;
  padding: 9px;
  resize: vertical;
  font-size: 11px;
  line-height: 1.6;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--teal);
  box-shadow: 0 0 0 2px rgba(40, 94, 88, 0.08);
}

.field-wide {
  grid-column: 1 / -1;
}

.image-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
}

.image-field input {
  border-radius: 3px 0 0 3px;
}

.image-field button {
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-left: 0;
  border-radius: 0 3px 3px 0;
  color: var(--teal);
  background: #f8f7f3;
  cursor: pointer;
}

.batch-output {
  min-width: 0;
}

.preview-heading {
  justify-content: space-between;
}

.preview-heading h2 {
  margin-top: 4px;
  font-family: "Songti SC", "STSong", serif;
  font-size: 20px;
}

.preview-heading > span {
  color: var(--teal);
  font-size: 9px;
}

.preview-heading > span.error {
  color: var(--accent);
}

.batch-preview {
  width: min(100%, 278px);
  display: grid;
  place-items: center;
  margin: 22px auto;
  overflow: hidden;
  aspect-ratio: 59 / 86;
  border: 1px solid var(--strong-line);
  background:
    linear-gradient(90deg, transparent 49.5%, rgba(28, 29, 27, 0.05) 50%),
    #e7e4dd;
}

.batch-preview img {
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.batch-preview > svg {
  color: var(--muted);
  font-size: 24px;
}

.render-progress > div {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 10px;
}

.render-progress > span {
  height: 3px;
  display: block;
  margin-top: 7px;
  overflow: hidden;
  background: var(--line);
}

.render-progress i {
  height: 100%;
  display: block;
  background: var(--accent);
}

.output-actions {
  display: grid;
  gap: 7px;
}

.production-scope {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 9px;
  text-align: center;
}

.output-actions button {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  color: var(--ink);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}

.output-actions button.primary {
  color: white;
  background: var(--ink);
}

.output-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spinning {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1040px) {
  .batch-workspace {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .batch-output {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(220px, 300px) minmax(260px, 1fr);
    align-items: center;
    gap: 24px;
    border-top: 1px solid var(--line);
  }

  .preview-heading {
    grid-column: 1 / -1;
  }

  .batch-preview {
    margin: 0 auto;
  }
}

@media (max-width: 700px) {
  .batch-header {
    grid-template-columns: 1fr auto;
    padding: 0 16px;
  }

  .batch-header nav {
    display: none;
  }

  .batch-workspace {
    display: block;
  }

  .batch-source,
  .batch-editor {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .batch-source section,
  .batch-editor,
  .batch-output {
    padding: 20px 16px;
  }

  .batch-list {
    max-height: 260px;
  }

  .editor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .editor-heading h2 {
    max-width: 65vw;
    font-size: 18px;
  }

  .batch-output {
    display: block;
  }

  .batch-preview {
    margin: 20px auto;
  }
}
</style>
