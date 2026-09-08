<template>
  <section class="print-queue" aria-label="打印队列">
    <div class="queue-heading">
      <div>
        <span>打印队列</span>
        <strong>{{ totalCount }} 张</strong>
      </div>
      <div>
        <button type="button" title="从卡组重置" @click="$emit('reset')">
          <Icon icon="ri:refresh-line" />
        </button>
        <button
          type="button"
          title="导出卡组总览图"
          :disabled="!entries.length"
          @click="$emit('export-overview')"
        >
          <Icon icon="ri:image-line" />
        </button>
      </div>
    </div>

    <div v-if="entries.length" class="queue-list">
      <article v-for="(entry, index) in entries" :key="entry.id">
        <CardMiniature
          :card-id="entry.id"
          :custom-card="getCustomCard(customCards, entry.id)"
          :resolved-card="resolvedCards.get(String(entry.id))"
          :alt="cardName(entry.id)"
        />
        <span class="queue-identity">
          <strong>{{ cardName(entry.id) }}</strong>
          <small>{{ cardNumber(entry.id) }}</small>
        </span>
        <span class="queue-count">
          <button
            type="button"
            title="减少打印份数"
            @click="$emit('set-count', { id: entry.id, count: entry.count - 1 })"
          >
            <Icon icon="ri:subtract-line" />
          </button>
          <output>{{ entry.count }}</output>
          <button
            type="button"
            title="增加打印份数"
            @click="$emit('set-count', { id: entry.id, count: entry.count + 1 })"
          >
            <Icon icon="ri:add-line" />
          </button>
        </span>
        <span class="queue-order">
          <button
            type="button"
            title="向前移动"
            :disabled="index === 0"
            @click="$emit('move', { index, direction: -1 })"
          >
            <Icon icon="ri:arrow-up-line" />
          </button>
          <button
            type="button"
            title="向后移动"
            :disabled="index === entries.length - 1"
            @click="$emit('move', { index, direction: 1 })"
          >
            <Icon icon="ri:arrow-down-line" />
          </button>
          <button
            type="button"
            title="从打印队列移除"
            @click="$emit('remove', entry.id)"
          >
            <Icon icon="ri:close-line" />
          </button>
        </span>
      </article>
    </div>
    <div v-else class="queue-empty">打印队列为空</div>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { computed, ref, watch } from 'vue';
import CardMiniature from './CardMiniature.vue';
import { resolveCard } from '@/features/cards/card-service';
import { getCustomCard } from '@/features/cards/custom-card';

const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  customCards: {
    type: Object,
    default: () => ({}),
  },
});

defineEmits([
  'set-count',
  'move',
  'remove',
  'reset',
  'export-overview',
]);

const names = ref(new Map());
const resolvedCards = ref(new Map());
const loadingIds = new Set();
const totalCount = computed(() =>
  props.entries.reduce((total, entry) => total + entry.count, 0));

const cardName = id => {
  return getCustomCard(props.customCards, id)?.name ||
    names.value.get(String(id)) ||
    '读取卡名…';
};

const cardNumber = id => {
  return getCustomCard(props.customCards, id)?.data?.password || id;
};

const loadName = async id => {
  const normalizedId = String(id);
  if (getCustomCard(props.customCards, normalizedId) ||
    resolvedCards.value.has(normalizedId) ||
    loadingIds.has(normalizedId)) return;
  loadingIds.add(normalizedId);
  try {
    const card = await resolveCard(normalizedId);
    names.value = new Map(names.value).set(normalizedId, card.name);
    resolvedCards.value = new Map(resolvedCards.value)
      .set(normalizedId, card);
  } catch {
    names.value = new Map(names.value).set(normalizedId, '名称暂不可用');
  } finally {
    loadingIds.delete(normalizedId);
  }
};

watch(
  () => props.entries.map(entry => entry.id),
  ids => ids.forEach(loadName),
  { immediate: true },
);
</script>

<style scoped>
.print-queue {
  margin-top: 16px;
  border-top: 1px solid var(--strong-line);
}

.queue-heading {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.queue-heading > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.queue-heading span,
.queue-heading strong {
  font-size: 10px;
}

.queue-heading strong {
  color: var(--teal);
  font-variant-numeric: tabular-nums;
}

.queue-heading button,
.queue-count button,
.queue-order button {
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

.queue-heading button:hover:not(:disabled),
.queue-count button:hover:not(:disabled),
.queue-order button:hover:not(:disabled) {
  border-color: var(--teal);
  color: var(--teal);
}

.queue-list {
  max-height: 250px;
  overflow: auto;
  border: 1px solid var(--line);
  background: var(--paper);
}

.queue-list article {
  min-height: 50px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border-bottom: 1px solid var(--line);
}

.queue-list article:last-child {
  border-bottom: 0;
}

.queue-list article > img,
.queue-list article > :deep(.card-thumbnail-state),
.queue-list article > :deep(.card-miniature) {
  width: 28px;
  height: 41px;
  object-fit: fill;
}

.queue-identity {
  min-width: 0;
}

.queue-identity strong,
.queue-identity small {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.queue-identity strong {
  font-size: 10px;
}

.queue-identity small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 8px;
}

.queue-count,
.queue-order {
  display: flex;
  align-items: center;
}

.queue-count {
  border: 1px solid var(--line);
  border-radius: 3px;
}

.queue-count button {
  border: 0;
}

.queue-count output {
  width: 24px;
  text-align: center;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.queue-order {
  gap: 3px;
}

.queue-order button:disabled,
.queue-heading button:disabled {
  opacity: 0.35;
  cursor: default;
}

.queue-empty {
  padding: 18px;
  border: 1px dashed var(--line);
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}
</style>
