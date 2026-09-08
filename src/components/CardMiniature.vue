<template>
  <span
    class="card-miniature"
    :class="`card-miniature--${appearance.key}`"
    :style="{
      '--miniature-frame': appearance.fallback,
      '--miniature-frame-image': `url(${appearance.image})`,
    }"
  >
    <span class="card-miniature__artwork">
      <img
        v-if="artworkSource && !artworkFailed"
        :src="artworkSource"
        :alt="alt"
        @error="artworkFailed = true"
      >
      <CardThumbnail
        v-else
        class="card-miniature__fallback"
        :card-id="cardId"
        :custom-card="customCard"
        :alt="alt"
      />
    </span>
  </span>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import CardThumbnail from './CardThumbnail.vue';
import frameEffect from '@/assets/yugioh-card/miniature/card-effect.webp';
import frameFusion from '@/assets/yugioh-card/miniature/card-fusion.webp';
import frameLink from '@/assets/yugioh-card/miniature/card-link.webp';
import frameNormal from '@/assets/yugioh-card/miniature/card-normal.webp';
import frameRitual from '@/assets/yugioh-card/miniature/card-ritual.webp';
import frameSpell from '@/assets/yugioh-card/miniature/card-spell.webp';
import frameSynchro from '@/assets/yugioh-card/miniature/card-synchro.webp';
import frameToken from '@/assets/yugioh-card/miniature/card-token.webp';
import frameTrap from '@/assets/yugioh-card/miniature/card-trap.webp';
import frameXyz from '@/assets/yugioh-card/miniature/card-xyz.webp';
import { isPrereleaseCardId } from '@/features/print/card-source';

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
  resolvedCard: {
    type: Object,
    default: null,
  },
  alt: {
    type: String,
    default: '',
  },
});

const APPEARANCES = {
  normal: {
    image: frameNormal,
    fallback: '#b88b42',
  },
  effect: {
    image: frameEffect,
    fallback: '#a85f37',
  },
  ritual: {
    image: frameRitual,
    fallback: '#557aaa',
  },
  fusion: {
    image: frameFusion,
    fallback: '#75528f',
  },
  synchro: {
    image: frameSynchro,
    fallback: '#d6d5ce',
  },
  xyz: {
    image: frameXyz,
    fallback: '#282a30',
  },
  link: {
    image: frameLink,
    fallback: '#315f8e',
  },
  token: {
    image: frameToken,
    fallback: '#a1947f',
  },
  spell: {
    image: frameSpell,
    fallback: '#2f8077',
  },
  trap: {
    image: frameTrap,
    fallback: '#99506f',
  },
};

const rendererData = computed(() =>
  props.customCard?.data ||
  props.resolvedCard?.rendererData ||
  {});

const artworkFailed = ref(false);

const artworkSource = computed(() => {
  if (props.source) return props.source;
  if (props.customCard?.data?.image) return props.customCard.data.image;
  if (props.resolvedCard?.rendererData?.image) {
    return props.resolvedCard.rendererData.image;
  }
  if (isPrereleaseCardId(props.cardId)) return '';
  const cardId = String(props.cardId || '').trim();
  return cardId
    ? `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(cardId)}.jpg`
    : '';
});

const appearance = computed(() => {
  const data = rendererData.value;
  const cardType = String(data.cardType || 'effect');
  const type = String(data.type || '');
  const key = type === 'spell' || type === 'trap'
    ? type
    : APPEARANCES[cardType]
      ? cardType
      : 'effect';
  return {
    key,
    ...APPEARANCES[key],
  };
});

watch(
  () => [
    props.cardId,
    props.source,
    props.customCard?.updatedAt,
    props.customCard?.data?.image,
  ],
  () => {
    artworkFailed.value = false;
  },
);
</script>

<style scoped>
.card-miniature {
  position: relative;
  width: 100%;
  height: auto;
  aspect-ratio: 59 / 86;
  display: block;
  overflow: hidden;
  border: 1px solid rgba(20, 20, 20, 0.36);
  border-radius: 2px;
  background-color: var(--miniature-frame);
  background-image: var(--miniature-frame-image);
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  box-shadow:
    0 1px 2px rgba(18, 18, 16, 0.22),
    0 4px 8px rgba(18, 18, 16, 0.09);
}

.card-miniature__artwork {
  position: absolute;
  z-index: 2;
  top: 18.4%;
  left: 12.2%;
  width: 75.6%;
  aspect-ratio: 1;
  display: block;
  overflow: hidden;
  border: 1px solid rgba(26, 25, 23, 0.62);
  background: #242526;
  box-shadow:
    0 1px 2px rgba(20, 18, 16, 0.32),
    inset 0 0 0 1px rgba(255, 255, 255, 0.13);
}

.card-miniature__artwork > img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.card-miniature__artwork > :deep(img.card-miniature__fallback) {
  position: absolute;
  top: -35.5%;
  left: -16.15%;
  width: 132.3%;
  height: auto;
  max-width: none;
}

.card-miniature__artwork > :deep(span.card-miniature__fallback) {
  width: 100%;
  height: 100%;
  display: grid;
}
</style>
