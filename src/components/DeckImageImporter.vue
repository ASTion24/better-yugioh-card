<template>
  <button
    v-if="!props.standalone && !props.triggerless"
    class="image-import-trigger"
    type="button"
    @click="openImporter"
  >
    <Icon icon="ri:image-circle-ai-line" />
    <span>图像识别</span>
    <small>PNG · JPEG · WebP</small>
  </button>

  <Teleport to="body" :disabled="props.standalone">
    <div
      v-if="props.standalone || opened"
      :class="props.standalone
        ? 'recognition-standalone'
        : 'recognition-backdrop'"
      :role="props.standalone ? 'region' : 'dialog'"
      :aria-modal="props.standalone ? undefined : 'true'"
      aria-label="图像识别"
      @click.self="!props.standalone && closeImporter()"
    >
      <section class="recognition-panel">
        <header class="recognition-header">
          <div>
            <span>CARD IMAGE RECOGNITION</span>
            <h2>图像识别</h2>
          </div>
          <div class="recognition-header-status">
            <span v-if="sourceName">{{ sourceName }}</span>
            <button
              v-if="!props.standalone"
              type="button"
              title="关闭"
              @click="closeImporter"
            >
              <Icon icon="ri:close-line" />
            </button>
          </div>
        </header>

        <input
          ref="imageInput"
          class="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          @change="onFileChange"
        >

        <div
          v-if="!sourceUrl && !cameraOpen"
          class="recognition-empty-state"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <div class="recognition-empty-copy">
            <Icon icon="ri:scan-2-line" />
            <strong>识别单卡或整副卡组</strong>
            <span>上传图片，或直接使用摄像头拍摄</span>
          </div>
          <div class="recognition-entry-actions">
            <button type="button" @click="imageInput?.click()">
              <Icon icon="ri:image-add-line" />
              <span>选择图片</span>
            </button>
            <button
              class="camera-entry-command"
              type="button"
              :disabled="!cameraSupported"
              :title="cameraSupported
                ? '打开摄像头'
                : '当前浏览器不支持摄像头'"
              @click="openCamera"
            >
              <Icon icon="ri:camera-line" />
              <span>打开摄像头</span>
            </button>
          </div>
          <small>支持规则截图、平铺照片和实时拍摄</small>
        </div>

        <div v-else-if="cameraOpen" class="camera-workspace">
          <div class="camera-toolbar">
            <div class="camera-mode-switch" aria-label="摄像头识别模式">
              <button
                v-for="mode in cameraModes"
                :key="mode.id"
                type="button"
                :class="{ active: cameraMode === mode.id }"
                @click="cameraMode = mode.id"
              >
                {{ mode.label }}
              </button>
            </div>
            <span>{{ cameraMode === 'single'
              ? '将单张卡片完整放入取景框'
              : '保持卡片无遮挡并尽量平铺' }}</span>
            <button
              type="button"
              title="切换前后摄像头"
              :disabled="cameraBusy"
              @click="switchCamera"
            >
              <Icon icon="ri:camera-switch-line" />
            </button>
            <button type="button" title="关闭摄像头" @click="closeCamera">
              <Icon icon="ri:close-line" />
            </button>
          </div>
          <div class="camera-stage">
            <video
              ref="cameraVideo"
              autoplay
              muted
              playsinline
              :class="{ mirrored: cameraFacingMode === 'user' }"
              @loadedmetadata="cameraReady = true"
            />
            <span
              class="camera-guide"
              :class="`camera-guide--${cameraMode}`"
              aria-hidden="true"
            />
            <div v-if="cameraBusy" class="camera-loading">
              <Icon class="spinning" icon="ri:loader-4-line" />
              <span>正在连接摄像头</span>
            </div>
          </div>
          <footer class="camera-footer">
            <span :class="{ error: cameraError }">
              {{ cameraError || cameraStatus }}
            </span>
            <button
              class="camera-capture-command"
              type="button"
              :disabled="!cameraReady || cameraBusy"
              @click="captureCameraFrame"
            >
              <Icon icon="ri:camera-lens-line" />
              <span>拍摄并识别</span>
            </button>
          </footer>
        </div>

        <template v-else>
          <div class="recognition-toolbar">
            <div class="layout-switch" aria-label="图片切分方式">
              <button
                v-for="mode in layoutModes"
                :key="mode.id"
                type="button"
                :class="{ active: layoutMode === mode.id }"
                @click="layoutMode = mode.id"
              >
                {{ mode.label }}
              </button>
            </div>
            <div v-if="layoutMode === 'grid'" class="grid-fields">
              <label>
                <span>列</span>
                <input
                  v-model.number="gridSettings.columns"
                  type="number"
                  min="1"
                  max="12"
                >
              </label>
              <label>
                <span>行</span>
                <input
                  v-model.number="gridSettings.rows"
                  type="number"
                  min="1"
                  max="12"
                >
              </label>
              <label>
                <span>边距%</span>
                <input
                  v-model.number="gridSettings.padding"
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                >
              </label>
              <label>
                <span>间隔%</span>
                <input
                  v-model.number="gridSettings.gap"
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                >
              </label>
            </div>
            <div class="recognition-tools">
              <button
                type="button"
                title="打开摄像头"
                :disabled="isRecognizing || !cameraSupported"
                @click="openCamera"
              >
                <Icon icon="ri:camera-line" />
              </button>
              <button
                type="button"
                title="更换图片"
                :disabled="isRecognizing"
                @click="imageInput?.click()"
              >
                <Icon icon="ri:image-edit-line" />
              </button>
              <button
                type="button"
                :disabled="isRecognizing"
                @click="splitAndRecognize"
              >
                <Icon icon="ri:grid-line" />
                <span>重新切分</span>
              </button>
              <button
                class="recognize-command"
                type="button"
                :disabled="!items.length || isRecognizing"
                @click="recognizeAll"
              >
                <Icon
                  :icon="isRecognizing ? 'ri:loader-4-line' : 'ri:scan-line'"
                  :class="{ spinning: isRecognizing }"
                />
                <span>{{ isRecognizing ? '识别中' : '重新识别' }}</span>
              </button>
            </div>
          </div>

          <div v-if="sourceError" class="recognition-message error">
            <Icon icon="ri:error-warning-line" />
            <span>{{ sourceError }}</span>
          </div>
          <div v-else-if="ocrStatus" class="recognition-message">
            <Icon icon="ri:pulse-line" />
            <span>
              {{ isRecognizing
                ? ocrStatus
                : `识别完成 · ${recognitionSummary.resolved} 张已确认` }}
            </span>
          </div>

          <div class="recognition-workspace">
            <div class="recognition-source">
              <div class="source-meta">
                <span>{{ sourceWidth }} × {{ sourceHeight }}</span>
                <strong>{{ regions.length }} 个区域</strong>
              </div>
              <div class="source-stage">
                <img :src="sourceUrl" alt="待识别卡组">
                <span
                  v-for="region in regions"
                  :key="region.id"
                  class="region-box"
                  :class="regionStatus(region.id)"
                  :style="regionStyle(region)"
                />
              </div>
            </div>

            <div
              ref="recognitionResults"
              class="recognition-results"
            >
              <button
                v-if="recognitionSummary.unresolved"
                class="pending-review-banner"
                type="button"
                aria-live="polite"
                @click="focusNextPending()"
              >
                <Icon icon="ri:error-warning-line" />
                <span>
                  <strong>
                    {{ recognitionSummary.unresolvedGroups }} 组待确认
                  </strong>
                  <small>
                    共 {{ recognitionSummary.unresolved }} 张，逐项确认后即可导入
                  </small>
                </span>
                <Icon icon="ri:arrow-down-line" />
              </button>
              <div class="results-summary">
                <span>已确认 {{ recognitionSummary.resolved }}</span>
                <span>待处理 {{ recognitionSummary.unresolved }}</span>
                <span>合计 {{ recognitionSummary.detected }}</span>
              </div>

              <div v-if="items.length" class="recognition-list">
                <article
                  v-for="(item, index) in items"
                  :key="item.id"
                  class="recognition-item"
                  :class="[
                    getRecognitionStatus(item),
                    { excluded: item.excluded },
                  ]"
                >
                  <div class="recognized-crop">
                    <img :src="item.crop" alt="">
                    <span>×{{ item.count }}</span>
                  </div>
                  <div class="recognized-body">
                    <div class="recognized-identity">
                      <span>{{ String(index + 1).padStart(2, '0') }}</span>
                      <strong>{{ item.name || '待确认卡片' }}</strong>
                      <small>{{ item.cardId || item.error || '未识别' }}</small>
                      <button
                        v-if="getRecognitionStatus(item) === 'review'"
                        type="button"
                        title="确认当前识别结果"
                        @click="confirmItem(item)"
                      >
                        <Icon icon="ri:check-line" />
                        <span>确认</span>
                      </button>
                    </div>
                    <div class="recognized-fields">
                      <label>
                        <span>数量</span>
                        <input
                          v-model.number="item.count"
                          type="number"
                          min="1"
                          max="99"
                          :disabled="item.excluded"
                        >
                      </label>
                      <label>
                        <span>分区</span>
                        <select
                          v-model="item.section"
                          :disabled="item.excluded"
                        >
                          <option value="main">主卡组</option>
                          <option value="extra">额外</option>
                          <option value="side">副卡组</option>
                        </select>
                      </label>
                    </div>
                    <form
                      class="recognized-search"
                      @submit.prevent="searchItem(item)"
                    >
                      <input
                        v-model="item.query"
                        type="search"
                        placeholder="输入卡号或名称"
                        :aria-label="`搜索第 ${index + 1} 组卡片`"
                        :disabled="item.excluded"
                      >
                      <button
                        type="submit"
                        title="搜索候选卡片"
                        :disabled="item.excluded || item.searching"
                      >
                        <Icon
                          :icon="item.searching
                            ? 'ri:loader-4-line'
                            : 'ri:search-line'"
                          :class="{ spinning: item.searching }"
                        />
                      </button>
                    </form>
                    <div
                      v-if="item.candidates.length"
                      class="candidate-list"
                    >
                      <button
                        v-for="candidate in item.candidates"
                        :key="candidate.id"
                        type="button"
                        @click="selectCandidate(item, candidate.raw)"
                      >
                        <CardMiniature
                          :card-id="candidate.id"
                          :resolved-card="candidate.resolved"
                          alt=""
                        />
                        <span>
                          <strong>{{ candidate.name }}</strong>
                          <small>{{ candidate.id }}</small>
                        </span>
                      </button>
                    </div>
                  </div>
                  <button
                    class="exclude-command"
                    type="button"
                    :title="item.excluded ? '恢复此组' : '排除此组'"
                    @click="item.excluded = !item.excluded"
                  >
                    <Icon
                      :icon="item.excluded
                        ? 'ri:restart-line'
                        : 'ri:delete-bin-line'"
                    />
                  </button>
                </article>
              </div>
              <div v-else class="results-empty">当前没有可识别区域</div>
            </div>
          </div>

          <footer class="recognition-footer">
            <span>
              {{ exportMessage || (recognitionSummary.unresolvedGroups
                ? `${recognitionSummary.unresolvedGroups} 组待确认`
                : '全部卡片已确认') }}
            </span>
            <div>
              <button
                v-if="!props.standalone"
                type="button"
                @click="closeImporter"
              >
                {{ isRecognizing ? '取消识别' : '取消' }}
              </button>
              <button
                v-if="canImport"
                class="export-command"
                type="button"
                title="复制标准 YDK 文本"
                :disabled="isRecognizing"
                @click="copyYdkText"
              >
                <Icon icon="ri:file-copy-line" />
                <span>复制文本</span>
              </button>
              <button
                v-if="canImport"
                class="export-command download-command"
                type="button"
                title="下载 YDK 文件"
                :disabled="isRecognizing"
                @click="downloadYdk"
              >
                <Icon icon="ri:download-line" />
                <span>下载 YDK</span>
              </button>
              <button
                v-if="!props.standalone || !canImport"
                :class="canImport
                  ? 'import-command'
                  : 'review-command'"
                type="button"
                :disabled="isRecognizing"
                :title="canImport
                  ? '导入已确认卡组'
                  : `还有 ${recognitionSummary.unresolved} 张卡片需要确认`"
                @click="handlePrimaryAction"
              >
                <Icon
                  :icon="canImport
                    ? 'ri:check-line'
                    : 'ri:error-warning-line'"
                />
                <span>
                  {{ canImport
                    ? (props.importLabel ||
                      `导入 ${recognitionSummary.resolved} 张`)
                    : `处理 ${recognitionSummary.unresolved} 张待确认` }}
                </span>
              </button>
            </div>
          </footer>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
} from 'vue';
import CardMiniature from './CardMiniature.vue';
import {
  resolveCard,
  resolveSearchResult,
} from '@/features/cards/card-service.js';
import {
  getCardArtworkId,
  getCardDisplayName,
  searchCardDatabase,
} from '@/features/print/card-source.js';
import {
  createDigitRecognizer,
  createRecognitionGroups,
  createSingleCardRegion,
  detectCardRegions,
  loadCardFingerprintIndex,
  loadRecognitionImage,
} from '@/features/recognition/browser-recognition.js';
import { matchFingerprint } from '@/features/recognition/fingerprint-index.js';
import {
  buildDeckFromRecognition,
  createGridRegions,
  getRecognitionStatus,
  isRecognitionConfirmed,
  mergeResolvedRecognitionItems,
  normalizeRecognizedCardId,
  summarizeRecognition,
} from '@/features/recognition/image-recognition.js';
import { serializeYdk } from '@/features/print/ydk.js';

const props = defineProps({
  importLabel: {
    type: String,
    default: '',
  },
  standalone: {
    type: Boolean,
    default: false,
  },
  triggerless: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['import', 'notice']);
const layoutModes = [
  { id: 'auto', label: '自动' },
  { id: 'grid', label: '规则网格' },
  { id: 'single', label: '单卡' },
];
const cameraModes = [
  { id: 'single', label: '单卡' },
  { id: 'multi', label: '多卡' },
];
const imageInput = ref(null);
const recognitionResults = ref(null);
const cameraVideo = ref(null);
const opened = ref(props.standalone);
const sourceUrl = ref('');
const sourceName = ref('');
const sourceWidth = ref(0);
const sourceHeight = ref(0);
const sourceError = ref('');
const regions = ref([]);
const items = ref([]);
const layoutMode = ref('auto');
const gridSettings = ref({
  columns: 5,
  rows: 8,
  padding: 1,
  gap: 1,
});
const isRecognizing = ref(false);
const ocrStatus = ref('');
const exportMessage = ref('');
const cameraOpen = ref(false);
const cameraMode = ref('single');
const cameraFacingMode = ref('environment');
const cameraReady = ref(false);
const cameraBusy = ref(false);
const cameraStatus = ref('');
const cameraError = ref('');
const cameraSupported = computed(() =>
  Boolean(globalThis.navigator?.mediaDevices?.getUserMedia));
let sourceCanvas = null;
let recognizer = null;
let cameraStream = null;
let recognitionRequest = 0;

const recognitionSummary = computed(() =>
  summarizeRecognition(items.value));
const canImport = computed(() => {
  const active = items.value.filter(item => !item.excluded);
  return active.length > 0 && active.every(isRecognitionConfirmed);
});
const itemByRegion = computed(() => {
  const result = new Map();
  items.value.forEach(item => {
    item.regions.forEach(region => result.set(region.id, item));
  });
  return result;
});

const openImporter = () => {
  opened.value = true;
};

const releaseCameraStream = () => {
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
  if (cameraVideo.value) {
    cameraVideo.value.srcObject = null;
  }
  cameraReady.value = false;
};

const startCamera = async () => {
  releaseCameraStream();
  cameraError.value = '';
  cameraStatus.value = '';
  if (!cameraSupported.value) {
    cameraError.value = '当前浏览器不支持摄像头';
    return;
  }
  cameraBusy.value = true;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: cameraFacingMode.value },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    if (!cameraVideo.value) {
      releaseCameraStream();
      return;
    }
    cameraVideo.value.srcObject = cameraStream;
    await cameraVideo.value.play();
    cameraReady.value = Boolean(
      cameraVideo.value.videoWidth &&
        cameraVideo.value.videoHeight,
    );
    cameraStatus.value = cameraReady.value
      ? '摄像头已就绪'
      : '正在等待视频画面';
  } catch (error) {
    releaseCameraStream();
    cameraError.value = error?.name === 'NotAllowedError'
      ? '未获得摄像头权限，请在浏览器设置中允许访问'
      : '无法打开摄像头，请检查设备是否被其他应用占用';
  } finally {
    cameraBusy.value = false;
  }
};

const openCamera = async () => {
  cameraOpen.value = true;
  await nextTick();
  await startCamera();
};

const closeCamera = () => {
  releaseCameraStream();
  cameraOpen.value = false;
  cameraBusy.value = false;
  cameraStatus.value = '';
  cameraError.value = '';
};

const switchCamera = async () => {
  cameraFacingMode.value = cameraFacingMode.value === 'environment'
    ? 'user'
    : 'environment';
  await startCamera();
};

const captureCameraFrame = async () => {
  const video = cameraVideo.value;
  if (!video?.videoWidth || !video.videoHeight || cameraBusy.value) return;
  cameraBusy.value = true;
  cameraError.value = '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    });
    if (!context) throw new Error('无法读取摄像头画面');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        value => value
          ? resolve(value)
          : reject(new Error('摄像头画面生成失败')),
        'image/jpeg',
        0.94,
      );
    });
    const captureMode = cameraMode.value === 'single'
      ? 'single'
      : 'auto';
    const file = new File(
      [blob],
      `camera-${cameraMode.value}-${Date.now()}.jpg`,
      { type: 'image/jpeg' },
    );
    closeCamera();
    await loadFile(file, captureMode);
  } catch (error) {
    cameraError.value = error instanceof Error
      ? error.message
      : String(error);
    cameraBusy.value = false;
  }
};

const openFile = async file => {
  opened.value = true;
  await loadFile(file);
};

const stopRecognizer = async () => {
  recognitionRequest += 1;
  isRecognizing.value = false;
  const activeRecognizer = recognizer;
  recognizer = null;
  if (activeRecognizer) {
    await activeRecognizer.terminate();
  }
  items.value.forEach(item => {
    item.recognizing = false;
  });
};

const clearSource = async () => {
  await stopRecognizer();
  sourceCanvas = null;
  sourceUrl.value = '';
  sourceName.value = '';
  sourceWidth.value = 0;
  sourceHeight.value = 0;
  sourceError.value = '';
  regions.value = [];
  items.value = [];
  ocrStatus.value = '';
  exportMessage.value = '';
};

const closeImporter = async () => {
  closeCamera();
  opened.value = false;
  await clearSource();
};

const splitImage = () => {
  if (!sourceCanvas) return;
  sourceError.value = '';
  exportMessage.value = '';
  if (layoutMode.value === 'grid') {
    regions.value = createGridRegions(
      sourceCanvas.width,
      sourceCanvas.height,
      gridSettings.value,
    );
  } else if (layoutMode.value === 'single') {
    regions.value = createSingleCardRegion(
      sourceCanvas.width,
      sourceCanvas.height,
    );
  } else {
    regions.value = detectCardRegions(sourceCanvas);
    if (!regions.value.length) {
      regions.value = createSingleCardRegion(
        sourceCanvas.width,
        sourceCanvas.height,
      );
      sourceError.value = '未检测到规则卡片边界，已按单卡切分';
    }
  }
  items.value = createRecognitionGroups(
    sourceCanvas,
    regions.value,
  );
  ocrStatus.value = '';
};

const loadFile = async (file, initialLayoutMode = 'auto') => {
  if (!file) return;
  await clearSource();
  try {
    sourceCanvas = await loadRecognitionImage(file);
    sourceUrl.value = sourceCanvas.toDataURL('image/jpeg', 0.9);
    sourceName.value = file.name;
    sourceWidth.value = sourceCanvas.width;
    sourceHeight.value = sourceCanvas.height;
    layoutMode.value = initialLayoutMode;
    await splitAndRecognize();
  } catch (error) {
    sourceError.value = error instanceof Error
      ? error.message
      : String(error);
  }
};

const onFileChange = event => {
  const file = event.target.files?.[0];
  loadFile(file);
  event.target.value = '';
};

const onDrop = event => {
  loadFile(event.dataTransfer?.files?.[0]);
};

const regionStyle = region => ({
  left: `${region.x / sourceWidth.value * 100}%`,
  top: `${region.y / sourceHeight.value * 100}%`,
  width: `${region.width / sourceWidth.value * 100}%`,
  height: `${region.height / sourceHeight.value * 100}%`,
});

const regionStatus = id => {
  const item = itemByRegion.value.get(id);
  return item ? getRecognitionStatus(item) : 'unresolved';
};

const applyResolvedCard = (item, resolved, source, confidence = 100) => {
  item.cardId = normalizeRecognizedCardId(resolved.artworkId || resolved.id);
  item.ydkId = normalizeRecognizedCardId(resolved.id || item.cardId);
  item.name = resolved.name;
  item.section = item.sectionHint || resolved.defaultSection || 'main';
  item.confidence = confidence;
  item.confirmed = source === 'manual';
  item.source = source;
  item.query = item.name;
  item.candidates = [];
  item.error = '';
};

const withTimeout = (promise, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('卡号校验超时')),
      timeoutMs,
    );
    promise.then(value => {
      clearTimeout(timer);
      resolve(value);
    }, error => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

const resolveOcrCandidates = async candidates => {
  for (const candidate of candidates.slice(0, 3)) {
    try {
      return await withTimeout(
        resolveCard(normalizeRecognizedCardId(candidate)),
        8000,
      );
    } catch {
      // Continue with the next OCR reading.
    }
  }
  return null;
};

const formatOcrStatus = message => {
  const labels = {
    'loading tesseract core': '载入识别引擎',
    'loading language traineddata': '载入数字模型',
    'initializing tesseract': '初始化识别引擎',
    'initializing api': '初始化识别接口',
    'recognizing text': '读取卡片编号',
  };
  const label = labels[message?.status] || '准备图像识别';
  const percent = Number.isFinite(message?.progress)
    ? ` ${Math.round(message.progress * 100)}%`
    : '';
  return `${label}${percent}`;
};

const recognizeAll = async () => {
  if (!sourceCanvas || isRecognizing.value) return;
  const request = ++recognitionRequest;
  isRecognizing.value = true;
  sourceError.value = '';
  let completed = 0;
  const targets = items.value.filter(item =>
    !item.excluded && !item.cardId);
  try {
    ocrStatus.value = '载入卡图指纹';
    try {
      const fingerprintIndex = await loadCardFingerprintIndex();
      for (const item of targets) {
        const [match] = matchFingerprint(
          fingerprintIndex,
          item.visualFingerprint,
          3,
        );
        if (!match || match.confidence < 40) continue;
        try {
          applyResolvedCard(
            item,
            await withTimeout(resolveCard(match.id), 8000),
            'visual',
            match.confidence,
          );
        } catch {
          // OCR remains available when a visual candidate cannot be resolved.
        }
      }
    } catch {
      ocrStatus.value = '视觉指纹不可用，转入卡号识别';
    }
    items.value = mergeResolvedRecognitionItems(items.value);
    const ocrTargets = items.value.filter(item =>
      !item.excluded &&
      !isRecognitionConfirmed(item));
    if (!ocrTargets.length) {
      ocrStatus.value =
        `视觉匹配完成 · ${recognitionSummary.value.resolved} 张已确认`;
      return;
    }
    recognizer = await createDigitRecognizer(message => {
      if (request === recognitionRequest) {
        ocrStatus.value = formatOcrStatus(message);
      }
    });
    for (const item of ocrTargets) {
      if (request !== recognitionRequest) break;
      item.recognizing = true;
      item.error = '';
      try {
        const result = await recognizer.recognize(
          sourceCanvas,
          item.region,
        );
        const resolved = await resolveOcrCandidates(result.candidates);
        if (resolved) {
          const sameVisualCandidate = item.cardId &&
            normalizeRecognizedCardId(item.cardId) ===
            normalizeRecognizedCardId(resolved.artworkId || resolved.id);
          applyResolvedCard(
            item,
            resolved,
            'ocr',
            sameVisualCandidate
              ? Math.max(90, result.confidence)
              : result.confidence,
          );
        } else if (!item.cardId) {
          item.error = result.candidates.length
            ? `未匹配 ${result.candidates[0]}`
            : '未读取到有效卡号';
        }
      } catch (error) {
        item.error = error instanceof Error
          ? error.message
          : String(error);
      } finally {
        item.recognizing = false;
        completed += 1;
        ocrStatus.value = `识别卡片 ${completed} / ${ocrTargets.length}`;
      }
    }
    items.value = mergeResolvedRecognitionItems(items.value);
  } catch (error) {
    sourceError.value = error instanceof Error
      ? error.message
      : String(error);
  } finally {
    if (recognizer) {
      await recognizer.terminate();
      recognizer = null;
    }
    if (request === recognitionRequest) {
      isRecognizing.value = false;
      ocrStatus.value = targets.length
        ? `识别完成 · ${recognitionSummary.value.resolved} 张已确认`
        : '';
      nextTick(() => {
        if (recognitionSummary.value.unresolved) {
          focusNextPending('auto');
        }
      });
    }
  }
};

const splitAndRecognize = async () => {
  splitImage();
  await recognizeAll();
};

const focusNextPending = (behavior = 'smooth') => {
  const target = recognitionResults.value?.querySelector(
    '.recognition-item.review, ' +
      '.recognition-item.error, ' +
      '.recognition-item.unresolved',
  );
  if (!target) return;
  target.scrollIntoView({
    behavior,
    block: 'center',
  });
  const control = target.querySelector(
    '.recognized-identity button, .recognized-search input',
  );
  control?.focus({ preventScroll: true });
};

const confirmItem = item => {
  item.confirmed = true;
  nextTick(() => focusNextPending());
};

const handlePrimaryAction = () => {
  if (canImport.value) {
    commitImport();
    return;
  }
  focusNextPending();
};

const searchItem = async item => {
  const query = item.query.trim();
  if (!query || item.searching) return;
  item.searching = true;
  item.error = '';
  try {
    const results = await searchCardDatabase(query);
    item.candidates = await Promise.all(
      results.slice(0, 5).map(async raw => ({
        id: getCardArtworkId(raw),
        name: getCardDisplayName(raw) || getCardArtworkId(raw),
        raw,
        resolved: await resolveSearchResult(raw),
      })),
    );
    if (!item.candidates.length) {
      item.error = '没有找到匹配卡片';
    }
  } catch (error) {
    item.error = error instanceof Error
      ? error.message
      : String(error);
  } finally {
    item.searching = false;
  }
};

const selectCandidate = async (item, result) => {
  item.searching = true;
  try {
    applyResolvedCard(
      item,
      await resolveSearchResult(result),
      'manual',
    );
  } catch (error) {
    item.error = error instanceof Error
      ? error.message
      : String(error);
  } finally {
    item.searching = false;
  }
};

const commitImport = () => {
  if (!canImport.value) return;
  const stem = sourceName.value
    .replace(/\.[^.]+$/, '')
    .trim();
  emit('import', {
    deck: buildDeckFromRecognition(items.value),
    name: stem,
    detected: recognitionSummary.value.detected,
  });
  emit('notice', `图像识别已导入 ${recognitionSummary.value.resolved} 张卡片`);
  opened.value = false;
  clearSource();
};

const getRecognizedDeck = () => {
  return buildDeckFromRecognition(items.value);
};

const getExportFilename = () => {
  const stem = sourceName.value
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
  return `${stem || 'image-deck'}.ydk`;
};

const copyYdkText = async () => {
  if (!canImport.value) {
    focusNextPending();
    return;
  }
  const value = serializeYdk(
    getRecognizedDeck(),
    'Better YGO Image Recognition',
  );
  try {
    await navigator.clipboard.writeText(value);
    exportMessage.value = 'YDK 文本已复制';
    emit('notice', exportMessage.value);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    exportMessage.value = copied
      ? 'YDK 文本已复制'
      : '浏览器禁止访问剪贴板';
    emit('notice', exportMessage.value);
  }
};

const downloadYdk = () => {
  if (!canImport.value) {
    focusNextPending();
    return;
  }
  const blob = new Blob([
    serializeYdk(
      getRecognizedDeck(),
      'Better YGO Image Recognition',
    ),
  ], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getExportFilename();
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  exportMessage.value = 'YDK 文件已下载';
  emit('notice', exportMessage.value);
};

onBeforeUnmount(() => {
  closeCamera();
  clearSource();
});

defineExpose({
  open: openImporter,
  openCamera,
  openFile,
});
</script>

<style lang="scss" scoped>
.image-import-trigger {
  width: 100%;
  min-height: 42px;
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 0 12px;
  border: 1px solid #b7b3aa;
  border-radius: 4px;
  color: #1c1d1b;
  background: #fffefa;
  cursor: pointer;
  text-align: left;
}

.image-import-trigger svg {
  color: #b94532;
  font-size: 18px;
}

.image-import-trigger span {
  font-size: 11px;
  font-weight: 700;
}

.image-import-trigger small {
  color: #74736e;
  font-size: 8px;
}

.recognition-backdrop {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(28, 29, 27, 0.76);
}

.recognition-standalone {
  height: 100%;
  display: grid;
  padding: 18px;
  background: #f0eee8;
}

.recognition-panel {
  --paper: #fffefa;
  --canvas: #f3f1ec;
  --ink: #1c1d1b;
  --muted: #74736e;
  --line: #d8d5ce;
  --strong-line: #b7b3aa;
  --accent: #b94532;
  --teal: #285e58;
  width: min(1120px, 100%);
  max-height: min(900px, calc(100vh - 44px));
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--strong-line);
  border-radius: 6px;
  color: var(--ink);
  background: var(--canvas);
  box-shadow: 0 26px 90px rgba(0, 0, 0, 0.32);
}

.recognition-standalone .recognition-panel {
  width: 100%;
  height: 100%;
  max-height: none;
  box-shadow: none;
}

.recognition-panel button,
.recognition-panel input,
.recognition-panel select {
  font: inherit;
}

.recognition-header {
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--line);
  background: #f8f7f3;
}

.recognition-header > div:first-child > span {
  color: var(--accent);
  font-family: "Avenir Next Condensed", sans-serif;
  font-size: 8px;
  font-weight: 800;
}

.recognition-header h2 {
  margin: 4px 0 0;
  font-family: "Songti SC", "STSong", serif;
  font-size: 18px;
}

.recognition-header-status {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.recognition-header-status > span {
  max-width: 260px;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recognition-header-status button,
.recognition-tools button,
.exclude-command {
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
}

.recognition-header-status button {
  width: 34px;
  height: 34px;
}

.recognition-empty-state {
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 18px;
  margin: 18px;
  padding: 28px;
  border: 1px dashed var(--strong-line);
  border-radius: 4px;
  color: var(--muted);
  background: var(--paper);
  text-align: center;
}

.recognition-empty-copy {
  display: grid;
  justify-items: center;
  gap: 8px;
}

.recognition-empty-copy svg {
  color: var(--teal);
  font-size: 34px;
}

.recognition-empty-copy strong {
  color: var(--ink);
  font-size: 13px;
}

.recognition-empty-copy span,
.recognition-empty-state > small {
  font-size: 10px;
}

.recognition-entry-actions {
  display: flex;
  gap: 8px;
}

.recognition-entry-actions button {
  min-width: 138px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--strong-line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.recognition-entry-actions .camera-entry-command {
  border-color: var(--ink);
  color: white;
  background: var(--ink);
}

.camera-workspace {
  min-height: 0;
  grid-row: 2 / -1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  color: white;
  background: #121514;
}

.camera-toolbar,
.camera-footer {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #1a1e1d;
}

.camera-toolbar {
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.camera-toolbar > span {
  margin-right: auto;
  color: rgba(255, 255, 255, 0.58);
  font-size: 9px;
}

.camera-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 4px;
}

.camera-mode-switch button {
  min-width: 62px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.62);
  background: transparent;
  cursor: pointer;
  font-size: 9px;
}

.camera-mode-switch button:last-child {
  border-right: 0;
}

.camera-mode-switch button.active {
  color: var(--ink);
  background: white;
}

.camera-toolbar > button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  background: transparent;
  cursor: pointer;
}

.camera-stage {
  min-height: 300px;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #080a09;
}

.camera-stage video {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  display: block;
  object-fit: contain;
}

.camera-stage video.mirrored {
  transform: scaleX(-1);
}

.camera-guide {
  position: relative;
  z-index: 2;
  display: block;
  border: 2px solid rgba(255, 255, 255, 0.88);
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(0, 0, 0, 0.34);
  pointer-events: none;
}

.camera-guide--single {
  height: min(82%, 560px);
  aspect-ratio: 59 / 86;
}

.camera-guide--multi {
  width: min(86%, 880px);
  height: min(76%, 540px);
  border-style: dashed;
}

.camera-loading {
  position: absolute;
  z-index: 3;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 9px;
  color: rgba(255, 255, 255, 0.76);
  background: rgba(8, 10, 9, 0.82);
  font-size: 10px;
}

.camera-loading svg {
  font-size: 22px;
}

.camera-footer {
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.camera-footer > span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 9px;
}

.camera-footer > span.error {
  color: #f0a192;
}

.camera-capture-command {
  min-width: 150px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 4px;
  color: var(--ink);
  background: white;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.recognition-toolbar {
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.layout-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--strong-line);
  border-radius: 4px;
  overflow: hidden;
}

.layout-switch button {
  height: 32px;
  padding: 0 13px;
  border: 0;
  border-right: 1px solid var(--line);
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  font-size: 9px;
}

.layout-switch button:last-child {
  border-right: 0;
}

.layout-switch button.active {
  color: white;
  background: var(--ink);
}

.grid-fields {
  display: flex;
  align-items: center;
  gap: 7px;
}

.grid-fields label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 8px;
}

.grid-fields input {
  width: 46px;
  height: 30px;
  padding: 0 5px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
  font-size: 10px;
}

.recognition-tools {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.recognition-tools button {
  min-width: 34px;
  height: 34px;
  display: inline-flex;
  gap: 6px;
  padding: 0 9px;
  font-size: 9px;
}

.recognition-tools .recognize-command {
  border-color: var(--ink);
  color: white;
  background: var(--ink);
}

.recognition-panel button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recognition-message {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-bottom: 1px solid #c9ddd9;
  color: var(--teal);
  background: #edf3f0;
  font-size: 10px;
}

.recognition-message.error {
  border-color: #e0bcb5;
  color: #8a3427;
  background: #f8e8e3;
}

.recognition-workspace {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(380px, 1.1fr);
}

.recognition-source,
.recognition-results {
  min-width: 0;
  min-height: 0;
}

.recognition-source {
  overflow: auto;
  padding: 16px;
  border-right: 1px solid var(--line);
  background: #e7e4dd;
}

.source-meta,
.results-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
  color: var(--muted);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.source-meta strong {
  color: var(--ink);
}

.source-stage {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--strong-line);
  background: #d7d4cc;
}

.source-stage > img {
  width: 100%;
  height: auto;
  display: block;
}

.region-box {
  box-sizing: border-box;
  position: absolute;
  border: 2px solid #b18a36;
  background: rgba(177, 138, 54, 0.08);
  pointer-events: none;
}

.region-box.confident,
.region-box.confirmed {
  border-color: #2f766d;
  background: rgba(47, 118, 109, 0.08);
}

.region-box.error {
  border-color: var(--accent);
  background: rgba(185, 69, 50, 0.1);
}

.region-box.excluded {
  border-color: #8e8c87;
  background: rgba(70, 70, 68, 0.28);
}

.recognition-results {
  overflow: auto;
  padding: 16px;
  background: #f8f7f3;
}

.results-summary {
  justify-content: flex-start;
  gap: 16px;
  min-height: 20px;
}

.pending-review-banner {
  width: 100%;
  min-height: 52px;
  position: sticky;
  z-index: 4;
  top: 0;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid #c8553c;
  border-radius: 4px;
  color: #72281d;
  background: #fff0eb;
  box-shadow: 0 4px 12px rgba(93, 34, 24, 0.14);
  cursor: pointer;
  text-align: left;
}

.pending-review-banner > svg:first-child {
  color: #b43e2c;
  font-size: 20px;
}

.pending-review-banner > svg:last-child {
  font-size: 16px;
}

.pending-review-banner strong,
.pending-review-banner small {
  display: block;
}

.pending-review-banner strong {
  font-size: 10px;
}

.pending-review-banner small {
  margin-top: 2px;
  color: #8d4d42;
  font-size: 8px;
}

.recognition-list {
  display: grid;
  gap: 8px;
}

.recognition-item {
  min-width: 0;
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) 30px;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--line);
  border-left: 3px solid #b18a36;
  border-radius: 4px;
  background: var(--paper);
}

.recognition-item.confident,
.recognition-item.confirmed {
  border-left-color: var(--teal);
}

.recognition-item.error {
  border-left-color: var(--accent);
}

.recognition-item.review,
.recognition-item.error,
.recognition-item.unresolved {
  border-color: #cf624d;
  border-left-width: 4px;
  background: #fff9f6;
  box-shadow: 0 0 0 1px rgba(185, 69, 50, 0.08);
}

.recognition-item.excluded {
  opacity: 0.46;
}

.recognized-crop {
  width: 70px;
  aspect-ratio: 59 / 86;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  background: #e3e0d9;
}

.recognized-crop img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.recognized-crop > span {
  position: absolute;
  right: 3px;
  bottom: 3px;
  min-width: 24px;
  padding: 2px 4px;
  color: white;
  background: rgba(28, 29, 27, 0.82);
  font-size: 8px;
  text-align: center;
}

.recognized-body {
  min-width: 0;
}

.recognized-identity {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: 2px 5px;
}

.recognized-identity > span {
  grid-row: 1 / 3;
  color: var(--accent);
  font-family: "Avenir Next Condensed", sans-serif;
  font-size: 9px;
  font-weight: 800;
}

.recognized-identity strong,
.recognized-identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recognized-identity strong {
  font-size: 10px;
}

.recognized-identity small {
  color: var(--muted);
  font-size: 8px;
}

.recognized-identity > button {
  grid-column: 3;
  grid-row: 1 / 3;
  align-self: center;
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 7px;
  border: 1px solid var(--teal);
  border-radius: 3px;
  color: var(--teal);
  background: transparent;
  cursor: pointer;
  font-size: 8px;
}

.recognized-fields {
  display: grid;
  grid-template-columns: 82px minmax(100px, 1fr);
  gap: 6px;
  margin-top: 7px;
}

.recognized-fields label {
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 8px;
}

.recognized-fields input,
.recognized-fields select,
.recognized-search input {
  min-width: 0;
  height: 28px;
  padding: 0 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: white;
  font-size: 9px;
}

.recognized-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  margin-top: 6px;
}

.recognized-search input {
  border-radius: 3px 0 0 3px;
}

.recognized-search button {
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-left: 0;
  border-radius: 0 3px 3px 0;
  color: var(--teal);
  background: white;
  cursor: pointer;
}

.candidate-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 6px;
}

.candidate-list button {
  min-width: 0;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 4px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: white;
  cursor: pointer;
  text-align: left;
}

.candidate-list img {
  width: 26px;
  height: 38px;
  object-fit: cover;
}

.candidate-list :deep(.card-miniature) {
  width: 26px;
  height: 38px;
}

.candidate-list span,
.candidate-list strong,
.candidate-list small {
  min-width: 0;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-list strong {
  font-size: 8px;
}

.candidate-list small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 7px;
}

.exclude-command {
  width: 30px;
  height: 30px;
}

.results-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--line);
  color: var(--muted);
  font-size: 10px;
}

.recognition-footer {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 18px;
  border-top: 1px solid var(--line);
  background: var(--paper);
}

.recognition-footer > span {
  color: var(--muted);
  font-size: 10px;
}

.recognition-footer > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.recognition-footer button {
  min-width: 78px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
  font-size: 10px;
}

.recognition-footer .import-command {
  min-width: 132px;
  border-color: var(--ink);
  color: white;
  background: var(--ink);
}

.recognition-footer .export-command {
  border-color: var(--teal);
  color: var(--teal);
  background: white;
}

.recognition-footer .download-command {
  color: white;
  background: var(--teal);
}

.recognition-footer .review-command {
  min-width: 168px;
  border-color: #b43e2c;
  color: white;
  background: #b43e2c;
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

.spinning {
  animation: recognition-spin 0.9s linear infinite;
}

@keyframes recognition-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 820px) {
  .recognition-backdrop {
    padding: 0;
  }

  .recognition-standalone {
    padding: 0;
  }

  .recognition-panel {
    width: 100%;
    height: 100dvh;
    max-height: none;
    border: 0;
    border-radius: 0;
  }

  .recognition-standalone .recognition-panel {
    height: 100%;
  }

  .camera-stage {
    min-height: 0;
  }

  .camera-guide--single {
    height: min(78%, 520px);
  }

  .recognition-toolbar {
    align-items: stretch;
    align-items: stretch;
    flex-wrap: wrap;
  }

  .layout-switch {
    flex: 1;
  }

  .layout-switch button {
    padding: 0 8px;
  }

  .grid-fields {
    width: 100%;
    order: 3;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .grid-fields label {
    display: grid;
  }

  .grid-fields input {
    width: 100%;
  }

  .recognition-tools {
    margin-left: 0;
  }

  .recognition-workspace {
    display: block;
    overflow: auto;
  }

  .recognition-source,
  .recognition-results {
    overflow: visible;
  }

  .recognition-source {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

}

@media (max-width: 480px) {
  .recognition-header {
    padding: 10px 12px;
  }

  .recognition-header-status > span {
    max-width: 150px;
  }

  .recognition-empty-state {
    min-height: 330px;
    margin: 12px;
    padding: 20px 12px;
  }

  .recognition-entry-actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recognition-entry-actions button {
    min-width: 0;
  }

  .camera-toolbar,
  .camera-footer {
    padding-right: 12px;
    padding-left: 12px;
  }

  .camera-toolbar > span {
    display: none;
  }

  .camera-mode-switch {
    margin-right: auto;
  }

  .camera-capture-command {
    min-width: 138px;
  }

  .recognition-toolbar,
  .recognition-source,
  .recognition-results,
  .recognition-footer {
    padding-right: 12px;
    padding-left: 12px;
  }

  .recognition-tools {
    width: 100%;
    order: 2;
  }

  .recognition-tools button {
    flex: 1;
  }

  .recognition-item {
    grid-template-columns: 58px minmax(0, 1fr) 28px;
    gap: 7px;
    padding: 7px;
  }

  .recognized-crop {
    width: 58px;
  }

  .recognized-fields {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .candidate-list {
    grid-template-columns: 1fr;
  }

  .recognition-footer > span {
    display: none;
  }

  .recognition-footer > div {
    width: 100%;
  }

  .recognition-footer button {
    flex: 1;
  }
}
</style>
