<template>
  <div
    class="cropper-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="裁切卡图"
  >
    <section class="cropper-panel">
      <header>
        <div>
          <span>ARTWORK CROP</span>
          <h2>调整卡图位置</h2>
        </div>
        <button type="button" title="关闭" @click="$emit('cancel')">
          <Icon icon="ri:close-line" />
        </button>
      </header>

      <canvas
        ref="previewCanvas"
        class="crop-preview"
        width="640"
        height="640"
        @pointerdown="startDrag"
        @pointermove="drag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      />

      <label>
        <span>缩放</span>
        <input
          v-model.number="zoom"
          type="range"
          min="1"
          max="3"
          step="0.01"
        >
        <output>{{ zoom.toFixed(2) }}×</output>
      </label>
      <label>
        <span>水平</span>
        <input
          v-model.number="offsetX"
          type="range"
          min="-1"
          max="1"
          step="0.01"
        >
        <output>{{ Math.round(offsetX * 100) }}</output>
      </label>
      <label>
        <span>垂直</span>
        <input
          v-model.number="offsetY"
          type="range"
          min="-1"
          max="1"
          step="0.01"
        >
        <output>{{ Math.round(offsetY * 100) }}</output>
      </label>

      <footer>
        <button type="button" @click="reset">重置</button>
        <button class="primary" type="button" @click="applyCrop">
          <Icon icon="ri:crop-line" />
          <span>应用裁切</span>
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['apply', 'cancel']);
const previewCanvas = ref(null);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
let sourceImage;
let dragging = false;
let dragOrigin = null;

const draw = (canvas, width, height) => {
  if (!sourceImage || !canvas) return;
  const context = canvas.getContext('2d');
  const baseScale = Math.max(
    width / sourceImage.naturalWidth,
    height / sourceImage.naturalHeight,
  );
  const scale = baseScale * zoom.value;
  const drawWidth = sourceImage.naturalWidth * scale;
  const drawHeight = sourceImage.naturalHeight * scale;
  const overflowX = Math.max(0, (drawWidth - width) / 2);
  const overflowY = Math.max(0, (drawHeight - height) / 2);
  const x = (width - drawWidth) / 2 + offsetX.value * overflowX;
  const y = (height - drawHeight) / 2 + offsetY.value * overflowY;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#e7e4dc';
  context.fillRect(0, 0, width, height);
  context.drawImage(sourceImage, x, y, drawWidth, drawHeight);
};

const renderPreview = () => {
  const canvas = previewCanvas.value;
  if (canvas) draw(canvas, canvas.width, canvas.height);
};

const loadSource = () => {
  sourceImage = new Image();
  sourceImage.onload = () => nextTick(renderPreview);
  sourceImage.src = props.source;
};

const reset = () => {
  zoom.value = 1;
  offsetX.value = 0;
  offsetY.value = 0;
};

const startDrag = event => {
  dragging = true;
  dragOrigin = {
    x: event.clientX,
    y: event.clientY,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
};

const drag = event => {
  if (!dragging || !dragOrigin) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  offsetX.value = Math.max(-1, Math.min(
    1,
    dragOrigin.offsetX + (event.clientX - dragOrigin.x) / bounds.width * 2,
  ));
  offsetY.value = Math.max(-1, Math.min(
    1,
    dragOrigin.offsetY + (event.clientY - dragOrigin.y) / bounds.height * 2,
  ));
};

const endDrag = () => {
  dragging = false;
  dragOrigin = null;
};

const applyCrop = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  draw(canvas, canvas.width, canvas.height);
  emit('apply', canvas.toDataURL('image/jpeg', 0.95));
};

watch([zoom, offsetX, offsetY], renderPreview);
watch(() => props.source, loadSource);
onMounted(loadSource);
</script>

<style scoped>
.cropper-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(28, 29, 27, 0.72);
}

.cropper-panel {
  width: min(480px, 100%);
  padding: 18px;
  border: 1px solid #aaa69d;
  border-radius: 6px;
  color: #1c1d1b;
  background: #f8f7f3;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.28);
}

header,
footer,
label {
  display: flex;
  align-items: center;
}

header {
  justify-content: space-between;
  margin-bottom: 14px;
}

header span {
  color: #b94532;
  font-size: 8px;
  font-weight: 800;
}

h2 {
  margin: 3px 0 0;
  font-size: 16px;
}

button {
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #b7b3aa;
  border-radius: 4px;
  color: #1c1d1b;
  background: #fffefa;
  cursor: pointer;
}

header button {
  width: 34px;
  padding: 0;
}

.crop-preview {
  width: 100%;
  display: block;
  aspect-ratio: 1;
  border: 1px solid #1c1d1b;
  background: #e7e4dc;
  cursor: grab;
  touch-action: none;
}

.crop-preview:active {
  cursor: grabbing;
}

label {
  gap: 10px;
  margin-top: 12px;
  font-size: 11px;
}

label span {
  width: 36px;
  color: #74736e;
}

label input {
  min-width: 0;
  flex: 1;
  accent-color: #285e58;
}

label output {
  width: 44px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

footer {
  justify-content: flex-end;
  gap: 7px;
  margin-top: 18px;
}

footer .primary {
  border-color: #1c1d1b;
  color: white;
  background: #1c1d1b;
}
</style>
