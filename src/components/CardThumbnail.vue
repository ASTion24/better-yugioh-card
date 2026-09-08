<template>
  <img
    v-if="resolvedSource && !failed"
    :src="resolvedSource"
    :alt="alt"
    @load="loading = false"
    @error="handleError"
  >
  <span v-else class="card-thumbnail-state" aria-hidden="true">
    <Icon
      :class="{ spinning: loading }"
      :icon="loading ? 'ri:loader-4-line' : 'ri:image-line'"
    />
  </span>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { ref, watch } from 'vue';
import { renderCustomCardThumbnail } from '@/features/cards/custom-card-render';
import {
  fetchPrereleaseImageDataUrl,
  getCardPreviewUrl,
  getCardThumbnailUrl,
  isPrereleaseCardId,
} from '@/features/print/card-source';

const props = defineProps({
  cardId: {
    type: [String, Number],
    default: '',
  },
  source: {
    type: String,
    default: '',
  },
  customCard: {
    type: Object,
    default: null,
  },
  quality: {
    type: String,
    default: 'thumbnail',
    validator: value => ['thumbnail', 'medium'].includes(value),
  },
  language: {
    type: String,
    default: 'sc',
  },
  alt: {
    type: String,
    default: '',
  },
});

const resolvedSource = ref('');
const loading = ref(false);
const failed = ref(false);
const useFallback = ref(false);
let request = 0;

const resolveSource = async () => {
  const currentRequest = ++request;
  const id = String(props.cardId || '');
  failed.value = false;
  if (props.source && !useFallback.value) {
    resolvedSource.value = props.source;
    loading.value = false;
    return;
  }
  if (!id) {
    resolvedSource.value = '';
    loading.value = false;
    return;
  }
  if (!props.customCard && !isPrereleaseCardId(id)) {
    resolvedSource.value = props.quality === 'medium' && !useFallback.value
      ? getCardPreviewUrl(id, props.language)
      : getCardThumbnailUrl(id);
    loading.value = false;
    return;
  }
  resolvedSource.value = '';
  loading.value = true;
  try {
    const source = props.customCard
      ? await renderCustomCardThumbnail(props.customCard)
      : await fetchPrereleaseImageDataUrl(id);
    if (currentRequest === request) {
      resolvedSource.value = source;
    }
  } catch {
    if (currentRequest === request) {
      failed.value = true;
    }
  } finally {
    if (currentRequest === request) {
      loading.value = false;
    }
  }
};

const handleError = async () => {
  const id = String(props.cardId || '');
  if (
    (
      props.quality === 'medium' ||
      props.customCard ||
      isPrereleaseCardId(id)
    ) &&
    !useFallback.value
  ) {
    useFallback.value = true;
    resolvedSource.value = '';
    await resolveSource();
    return;
  }
  failed.value = true;
  loading.value = false;
};

watch(
  () => [
    props.cardId,
    props.source,
    props.customCard?.updatedAt,
    props.customCard?.data?.image,
    props.quality,
    props.language,
  ],
  () => {
    useFallback.value = false;
    resolveSource();
  },
  { immediate: true },
);
</script>

<style scoped>
.card-thumbnail-state {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #74736e;
  background: #e9e7e1;
}

.card-thumbnail-state svg {
  font-size: 18px;
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
