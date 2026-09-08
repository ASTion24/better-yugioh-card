import { BATCH_CARD_DEFAULTS } from './batch-parser.js';

const clone = value => JSON.parse(JSON.stringify(value));

export const createBatchId = () => globalThis.crypto?.randomUUID?.() ||
  `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const createBatchCard = (data, options = {}) => ({
  ...clone(BATCH_CARD_DEFAULTS),
  ...clone(data || {}),
  name: String(data?.name || options.name || '未命名卡片'),
  password: String(data?.password || ''),
  sourceCardId: String(
    options.sourceCardId || data?.sourceCardId || '',
  ),
  batchId: options.batchId || data?.batchId || createBatchId(),
});

export const resolvedCardToBatchCard = resolved => createBatchCard(
  resolved?.rendererData,
  {
    name: resolved?.name,
    sourceCardId: resolved?.artworkId || resolved?.id,
  },
);

export const appendBatchCards = (project, sourceCards) => ({
  ...project,
  kind: 'batch',
  cards: [
    ...(project?.cards || []).map(card => createBatchCard(card)),
    ...sourceCards.map(card => createBatchCard(card)),
  ],
});

export const writeBatchCard = (project, data, options = {}) => {
  const mode = options.mode === 'add' ? 'add' : 'replace';
  const sourceId = String(options.sourceId || '');
  const cards = (project?.cards || []).map(card => createBatchCard(card));
  const existingIndex = cards.findIndex(card => card.batchId === sourceId);
  const sourceCardId = options.sourceCardId ||
    cards[existingIndex]?.sourceCardId ||
    '';
  const nextCard = createBatchCard(data, {
    batchId: mode === 'replace' && existingIndex >= 0 ? sourceId : '',
    sourceCardId,
  });

  if (mode === 'replace' && existingIndex >= 0) {
    cards.splice(existingIndex, 1, nextCard);
  } else {
    cards.splice(existingIndex >= 0 ? existingIndex + 1 : cards.length, 0, nextCard);
  }

  return {
    ...project,
    kind: 'batch',
    cards,
  };
};
