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
export const PRINT_RENDER_MODES = Object.freeze({
  MEDIUM: 'medium',
  HIGH: 'high',
});
export const DEFAULT_PRINT_RENDER_MODE = PRINT_RENDER_MODES.MEDIUM;

export const resolvePrintableRenderMode = mode => {
  if (mode === undefined) {
    return DEFAULT_PRINT_RENDER_MODE;
  }
  if (Object.values(PRINT_RENDER_MODES).includes(mode)) {
    return mode;
  }
  throw new Error('低清缩略图不能生成打印文件');
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
    language = 'sc',
    customCards = {},
    onProgress,
  } = options;
  const mode = resolvePrintableRenderMode(options.mode);
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
          throw new Error(`卡组中缺少原创卡 ${cardId}`);
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
      } else if (mode === PRINT_RENDER_MODES.HIGH) {
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

  const requiresSerialRendering =
    mode === PRINT_RENDER_MODES.HIGH ||
    uniqueIds.some(isCustomCardId);
  await runWithConcurrency(tasks, requiresSerialRendering ? 1 : 4);

  return {
    cards: normalizedIds.map(id => imageMap.get(id) || { id, dataUrl: null }),
    errors,
    normalizedIds,
    prereleaseFallbacks,
    fullCardFallbacks,
  };
};
