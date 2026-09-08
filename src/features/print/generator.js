import {
  getCustomCard,
  isCustomCardId,
} from '../cards/custom-card.js';
import { renderCustomCard } from '../cards/custom-card-render.js';
import {
  fetchCardImageDataUrl,
  fetchIdChangelog,
  isPrereleaseCardId,
  normalizeCardIds,
} from './card-source.js';
import { runWithConcurrency } from './concurrency.js';

const highResolutionPromiseMap = new Map();

export const shouldRenderHighResolution = (cardId, mode) => {
  return mode === 'high' || isPrereleaseCardId(cardId);
};

const renderCachedHighResolutionCard = async cardId => {
  if (highResolutionPromiseMap.has(cardId)) {
    return highResolutionPromiseMap.get(cardId);
  }
  const promise = import('./render-card.js')
    .then(({ renderHighResolutionCard }) => renderHighResolutionCard(cardId))
    .catch(error => {
      highResolutionPromiseMap.delete(cardId);
      throw error;
    });
  highResolutionPromiseMap.set(cardId, promise);
  return promise;
};

export const preparePrintableCards = async (cardIds, options = {}) => {
  const {
    mode = 'quick',
    language = 'zh',
    customCards = {},
    onProgress,
  } = options;
  const idChangelog = await fetchIdChangelog();
  const normalizedIds = normalizeCardIds(cardIds, idChangelog);
  const uniqueIds = [...new Set(normalizedIds)];
  const imageMap = new Map();
  const errors = [];
  const prereleaseFallbacks = [];
  const fullCardFallbacks = [];
  let done = 0;

  const tasks = uniqueIds.map(cardId => async () => {
    try {
      let card;
      if (isCustomCardId(cardId)) {
        const customCard = getCustomCard(customCards, cardId);
        if (!customCard) {
          throw new Error(`卡组项目中缺少原创卡 ${cardId}`);
        }
        card = {
          id: cardId,
          name: customCard.name,
          custom: true,
          dataUrl: await renderCustomCard(customCard, {
            format: 'jpg',
            quality: 0.94,
          }),
        };
      } else if (shouldRenderHighResolution(cardId, mode)) {
        try {
          card = await renderCachedHighResolutionCard(cardId);
          if (card.fullCardFallback) {
            fullCardFallbacks.push(cardId);
          }
        } catch (error) {
          if (!isPrereleaseCardId(cardId)) {
            throw error;
          }
          prereleaseFallbacks.push(cardId);
          card = {
            id: cardId,
            dataUrl: await fetchCardImageDataUrl(cardId, language),
          };
        }
      } else {
        card = {
          id: cardId,
          dataUrl: await fetchCardImageDataUrl(cardId, language),
        };
      }
      imageMap.set(cardId, card);
    } catch (error) {
      errors.push({
        id: cardId,
        message: error instanceof Error ? error.message : String(error),
      });
      imageMap.set(cardId, { id: cardId, dataUrl: null });
    } finally {
      done += 1;
      onProgress?.({
        done,
        total: uniqueIds.length,
        cardId,
      });
    }
  });

  const requiresSerialRendering = mode === 'high' ||
    uniqueIds.some(cardId =>
      isCustomCardId(cardId) || isPrereleaseCardId(cardId));
  await runWithConcurrency(
    tasks,
    requiresSerialRendering ? 1 : 4,
  );

  return {
    cards: normalizedIds.map(id => imageMap.get(id) || { id, dataUrl: null }),
    errors,
    normalizedIds,
    prereleaseFallbacks,
    fullCardFallbacks,
  };
};
