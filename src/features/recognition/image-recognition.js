const CARD_ASPECT_RATIO = 59 / 86;
const SECTION_KEYS = new Set(['main', 'extra', 'side']);
const OCR_DIGIT_MAP = {
  B: '8',
  D: '0',
  G: '6',
  I: '1',
  L: '1',
  O: '0',
  Q: '0',
  S: '5',
  Z: '2',
};

const clamp = (value, minimum, maximum) => {
  return Math.min(maximum, Math.max(minimum, value));
};

const normalizeInteger = (value, fallback, minimum, maximum) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number)
    ? clamp(number, minimum, maximum)
    : fallback;
};

const normalizeNumber = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? clamp(number, minimum, maximum)
    : fallback;
};

export const normalizeGridSettings = value => ({
  columns: normalizeInteger(value?.columns, 5, 1, 12),
  rows: normalizeInteger(value?.rows, 8, 1, 12),
  padding: normalizeNumber(value?.padding, 1, 0, 20),
  gap: normalizeNumber(value?.gap, 1, 0, 12),
});

export const createGridRegions = (widthValue, heightValue, value = {}) => {
  const width = Math.max(1, Number(widthValue) || 1);
  const height = Math.max(1, Number(heightValue) || 1);
  const settings = normalizeGridSettings(value);
  const unit = Math.min(width, height) / 100;
  const padding = settings.padding * unit;
  const gap = settings.gap * unit;
  const availableWidth = width - padding * 2 -
    gap * (settings.columns - 1);
  const availableHeight = height - padding * 2 -
    gap * (settings.rows - 1);
  if (availableWidth <= 0 || availableHeight <= 0) return [];

  const cellWidth = availableWidth / settings.columns;
  const cellHeight = availableHeight / settings.rows;
  const cardWidth = Math.min(cellWidth, cellHeight * CARD_ASPECT_RATIO);
  const cardHeight = cardWidth / CARD_ASPECT_RATIO;
  const insetX = (cellWidth - cardWidth) / 2;
  const insetY = (cellHeight - cardHeight) / 2;
  const regions = [];

  for (let row = 0; row < settings.rows; row += 1) {
    for (let column = 0; column < settings.columns; column += 1) {
      regions.push({
        id: `grid-${row}-${column}`,
        row,
        column,
        x: padding + column * (cellWidth + gap) + insetX,
        y: padding + row * (cellHeight + gap) + insetY,
        width: cardWidth,
        height: cardHeight,
      });
    }
  }
  return regions;
};

const bitCount = value => {
  let number = value;
  let count = 0;
  while (number) {
    count += Number(number & 1n);
    number >>= 1n;
  }
  return count;
};

export const hammingDistance = (first, second) => {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  try {
    return bitCount(BigInt(`0x${first}`) ^ BigInt(`0x${second}`));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export const groupRecognitionRegions = (
  entries,
  maximumDistance = 0,
) => {
  const groups = [];
  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    const fingerprint = String(entry?.fingerprint || '');
    const sectionHint = SECTION_KEYS.has(entry?.region?.sectionHint)
      ? entry.region.sectionHint
      : '';
    const group = groups.find(item =>
      fingerprint &&
      item.sectionHint === sectionHint &&
      hammingDistance(item.fingerprint, fingerprint) <= maximumDistance);
    if (group) {
      group.regions.push(entry.region);
      group.crops.push(entry.crop);
      group.count += 1;
      return;
    }
    groups.push({
      id: `recognition-${index + 1}`,
      fingerprint,
      region: entry.region,
      regions: [entry.region],
      crop: entry.crop,
      crops: [entry.crop],
      visualFingerprint: entry.visualFingerprint || {
        art: fingerprint,
        full: fingerprint,
        color: [0, 0, 0],
      },
      count: 1,
      cardId: '',
      name: '',
      section: sectionHint || 'main',
      sectionHint,
      confidence: 0,
      confirmed: false,
      source: '',
      query: '',
      candidates: [],
      searching: false,
      recognizing: false,
      excluded: false,
      error: '',
    });
  });
  return groups;
};

const normalizeOcrSegment = value => {
  return [...value.toUpperCase()]
    .map(character => OCR_DIGIT_MAP[character] || character)
    .join('');
};

export const extractCardIdCandidates = value => {
  const candidates = [];
  const segments = String(value || '')
    .toUpperCase()
    .match(/[0-9BDGILOQSZ][0-9BDGILOQSZ \t._-]{5,14}/g) || [];
  segments.forEach(segment => {
    const digits = normalizeOcrSegment(segment).replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 9) {
      candidates.push(digits);
    }
    if (digits.length > 9) {
      for (let index = 0; index <= digits.length - 8; index += 1) {
        candidates.push(digits.slice(index, index + 8));
      }
    }
  });
  return [...new Set(candidates)]
    .sort((first, second) => {
      const firstScore = first.length === 8 ? 0 : 1;
      const secondScore = second.length === 8 ? 0 : 1;
      return firstScore - secondScore;
    });
};

export const normalizeRecognizedCardId = value => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || '';
};

export const mergeResolvedRecognitionItems = value => {
  const result = [];
  const grouped = new Map();
  (Array.isArray(value) ? value : []).forEach(item => {
    const cardId = normalizeRecognizedCardId(item?.cardId);
    if (!cardId || item?.excluded) {
      result.push(item);
      return;
    }
    const section = SECTION_KEYS.has(item.section)
      ? item.section
      : 'main';
    const key = `${section}:${cardId}`;
    const existing = grouped.get(key);
    if (!existing) {
      const copy = {
        ...item,
        cardId,
        section,
        regions: [...(item.regions || [])],
        crops: [...(item.crops || [])],
      };
      grouped.set(key, copy);
      result.push(copy);
      return;
    }
    existing.count = normalizeInteger(
      Number(existing.count) + Number(item.count),
      existing.count,
      1,
      99,
    );
    existing.regions.push(...(item.regions || []));
    existing.crops.push(...(item.crops || []));
    existing.confidence = Math.max(
      Number(existing.confidence) || 0,
      Number(item.confidence) || 0,
    );
    existing.confirmed = isRecognitionConfirmed(existing) ||
      isRecognitionConfirmed(item);
    if (item.source === 'manual') existing.source = 'manual';
    existing.error = '';
  });
  return result;
};

export const isRecognitionConfirmed = item => {
  if (item?.excluded) return true;
  if (!item?.cardId) return false;
  return item.source === 'manual' ||
    Boolean(item.confirmed) ||
    Number(item.confidence) >= 80;
};

export const buildDeckFromRecognition = items => {
  const deck = {
    main: [],
    extra: [],
    side: [],
    warnings: [],
  };
  (Array.isArray(items) ? items : []).forEach(item => {
    if (item?.excluded || !isRecognitionConfirmed(item)) return;
    const section = SECTION_KEYS.has(item.section)
      ? item.section
      : 'main';
    const cardId = normalizeRecognizedCardId(
      item.ydkId || item.cardId,
    );
    const count = normalizeInteger(item.count, 1, 1, 99);
    if (!cardId) return;
    deck[section].push(
      ...Array.from({ length: count }, () => cardId),
    );
  });
  return deck;
};

export const summarizeRecognition = items => {
  const active = (Array.isArray(items) ? items : [])
    .filter(item => !item?.excluded);
  return active.reduce((summary, item) => {
    const count = normalizeInteger(item?.count, 1, 1, 99);
    summary.detected += count;
    if (isRecognitionConfirmed(item)) {
      summary.resolved += count;
    } else {
      summary.unresolved += count;
      summary.unresolvedGroups += 1;
    }
    return summary;
  }, {
    detected: 0,
    resolved: 0,
    unresolved: 0,
    unresolvedGroups: 0,
  });
};

export const getRecognitionStatus = item => {
  if (item?.excluded) return 'excluded';
  if (item?.recognizing || item?.searching) return 'working';
  if (!item?.cardId) return item?.error ? 'error' : 'unresolved';
  if (item.source === 'manual' || item.confirmed) return 'confirmed';
  return Number(item.confidence) >= 80 ? 'confident' : 'review';
};
