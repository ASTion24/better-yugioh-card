import { BATCH_CARD_DEFAULTS } from './batch-parser.js';

const decodeDataUrl = dataUrl => {
  const [metadata, payload] = String(dataUrl).split(',', 2);
  if (!metadata || payload === undefined) {
    throw new Error('卡图数据格式无效');
  }
  if (metadata.includes(';base64')) {
    const binary = atob(payload);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
};

const escapeCsvCell = value => {
  const text = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value ?? '');
  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export const BATCH_EXPORT_FIELDS = [
  'password',
  'sourceCardId',
  ...Object.keys(BATCH_CARD_DEFAULTS).filter(key => key !== 'password'),
];

export const serializeBatchJson = cards => JSON.stringify({
  cards: cards.map(({ batchId: _batchId, ...card }) => card),
}, null, 2);

export const serializeBatchCsv = cards => [
  BATCH_EXPORT_FIELDS.join(','),
  ...cards.map(card =>
    BATCH_EXPORT_FIELDS.map(field => escapeCsvCell(card[field])).join(',')),
].join('\n');

export const sanitizeFilename = value => {
  const normalized = String(value || '未命名卡片')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ');
  return normalized || '未命名卡片';
};

export const dataUrlToBlob = dataUrl => {
  const mimeType = String(dataUrl).match(/^data:([^;,]+)/)?.[1] ||
    'application/octet-stream';
  return new Blob([decodeDataUrl(dataUrl)], { type: mimeType });
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const createBatchZip = async renderedCards => {
  const { zipSync } = await import('fflate');
  const usedNames = new Map();
  const files = {};

  renderedCards.forEach((card, index) => {
    const baseName = sanitizeFilename(
      [card.password, card.name].filter(Boolean).join('-'),
    );
    const occurrence = (usedNames.get(baseName) || 0) + 1;
    usedNames.set(baseName, occurrence);
    const suffix = occurrence > 1 ? `-${occurrence}` : '';
    const sequence = String(index + 1).padStart(3, '0');
    files[`${sequence}-${baseName}${suffix}.png`] = decodeDataUrl(card.dataUrl);
  });

  return new Blob([zipSync(files, { level: 0 })], {
    type: 'application/zip',
  });
};

export const createBatchDeliveryZip = async renderedCards => {
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const usedNames = new Map();
  const files = {};
  const manifest = [
    ['sequence', 'filename', 'name', 'password', 'type', 'status', 'issues'],
  ];

  renderedCards.forEach((card, index) => {
    const baseName = sanitizeFilename(
      [card.password, card.name].filter(Boolean).join('-'),
    );
    const occurrence = (usedNames.get(baseName) || 0) + 1;
    usedNames.set(baseName, occurrence);
    const suffix = occurrence > 1 ? `-${occurrence}` : '';
    const sequence = String(index + 1).padStart(3, '0');
    const filename = `${sequence}-${baseName}${suffix}.png`;
    files[`cards/${filename}`] = decodeDataUrl(card.dataUrl);
    manifest.push([
      sequence,
      filename,
      card.name,
      card.password,
      card.cardType || card.type,
      card.quality?.status || 'ready',
      (card.quality?.issues || []).map(item => item.message).join('；'),
    ]);
  });

  files['manifest.csv'] = encoder.encode(
    manifest
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\n'),
  );
  files['batch-data.json'] = encoder.encode(JSON.stringify({
    cards: renderedCards.map(({
      dataUrl: _dataUrl,
      quality: _quality,
      batchId: _batchId,
      ...card
    }) => card),
  }, null, 2));

  return new Blob([zipSync(files, { level: 0 })], {
    type: 'application/zip',
  });
};
