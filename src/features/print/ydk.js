const SECTION_MARKER_MAP = new Map([
  ['#main', 'main'],
  ['#extra', 'extra'],
  ['!side', 'side'],
  ['#side', 'side'],
]);

const MAX_YDK_LINES = 200;
const CARD_ID_PATTERN = /^\d{1,12}$/;
const OURYGO_DECK_HOST = 'deck.ourygo.top';
const OURYGO_V1_HEADER_BITS = 16;
const OURYGO_V1_CARD_BITS = 29;

const emptyDeck = () => ({
  main: [],
  extra: [],
  side: [],
  warnings: [],
});

const decodeBase64 = value => {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(normalized) || normalized.length % 4 === 1) {
    throw new Error('Base64 数据无效');
  }
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(padded, 'base64'));
  }
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

const encodeBase64 = bytes => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeYdkeSection = value => {
  if (!value) {
    return [];
  }
  const bytes = decodeBase64(value);
  if (bytes.length % 4 !== 0) {
    throw new Error('YDKe 分区数据长度无效');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = [];
  for (let offset = 0; offset < bytes.length; offset += 4) {
    result.push(String(view.getUint32(offset, true)));
  }
  return result;
};

export const parseYdke = input => {
  const normalized = input.trim();
  if (!normalized.toLowerCase().startsWith('ydke://')) {
    throw new Error('YDKe 必须以 ydke:// 开头');
  }
  const sections = normalized.slice(7).split('!');
  if (sections.length < 3) {
    throw new Error('YDKe 缺少主卡组、额外卡组或副卡组分区');
  }
  return {
    main: decodeYdkeSection(sections[0]),
    extra: decodeYdkeSection(sections[1]),
    side: decodeYdkeSection(sections[2]),
    warnings: [],
  };
};

const parseOurygoV0Section = (value, sectionName) => {
  if (!value) {
    return [];
  }
  return value.split('_').filter(Boolean).flatMap(item => {
    const match = item.match(/^(\d{1,12})(?:\*(\d+))?$/);
    if (!match) {
      throw new Error(`OURYGO ${sectionName} 分区包含无效卡片项：${item}`);
    }
    const count = match[2] ? Number(match[2]) : 1;
    if (!Number.isSafeInteger(count) || count < 1 || count > 99) {
      throw new Error(`OURYGO ${sectionName} 分区的卡片数量无效：${item}`);
    }
    return Array.from({ length: count }, () => match[1]);
  });
};

const parseOurygoV1 = value => {
  if (!value) {
    throw new Error('OURYGO 链接缺少卡组数据');
  }
  const bytes = decodeBase64(value);
  const bits = Array.from(
    bytes,
    byte => byte.toString(2).padStart(8, '0'),
  ).join('');
  if (bits.length < OURYGO_V1_HEADER_BITS) {
    throw new Error('OURYGO 卡组数据不完整');
  }

  const entryCounts = {
    main: Number.parseInt(bits.slice(0, 8), 2),
    extra: Number.parseInt(bits.slice(8, 12), 2),
    side: Number.parseInt(bits.slice(12, 16), 2),
  };
  const totalEntries = Object.values(entryCounts)
    .reduce((total, count) => total + count, 0);
  const requiredBits = OURYGO_V1_HEADER_BITS +
    totalEntries * OURYGO_V1_CARD_BITS;
  if (bits.length < requiredBits) {
    throw new Error('OURYGO 卡组数据不完整，缺少卡片');
  }

  const deck = emptyDeck();
  let offset = OURYGO_V1_HEADER_BITS;
  Object.entries(entryCounts).forEach(([section, entryCount]) => {
    for (let index = 0; index < entryCount; index += 1) {
      const count = Number.parseInt(bits.slice(offset, offset + 2), 2);
      const cardId = Number.parseInt(bits.slice(offset + 2, offset + 29), 2);
      offset += OURYGO_V1_CARD_BITS;
      if (count < 1 || cardId < 1) {
        throw new Error(`OURYGO ${section} 分区包含无效卡片数据`);
      }
      deck[section].push(
        ...Array.from({ length: count }, () => String(cardId)),
      );
    }
  });
  return deck;
};

export const parseOurygoDeckUrl = input => {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('OURYGO 卡组链接无效');
  }
  if (!['http:', 'https:'].includes(url.protocol) ||
      url.hostname.toLowerCase() !== OURYGO_DECK_HOST) {
    throw new Error('仅支持 deck.ourygo.top 卡组链接');
  }
  const ygoType = url.searchParams.get('ygotype');
  if (ygoType && ygoType.toLowerCase() !== 'deck') {
    throw new Error('OURYGO 链接不是卡组类型');
  }

  const version = url.searchParams.get('v') ||
    (url.searchParams.has('d') ? '1' : '0');
  let deck;
  if (version === '1') {
    deck = parseOurygoV1(url.searchParams.get('d') || '');
  } else if (version === '0') {
    deck = {
      ...emptyDeck(),
      main: parseOurygoV0Section(url.searchParams.get('main'), 'main'),
      extra: parseOurygoV0Section(url.searchParams.get('extra'), 'extra'),
      side: parseOurygoV0Section(url.searchParams.get('side'), 'side'),
    };
  } else {
    throw new Error(`暂不支持 OURYGO v${version} 卡组链接`);
  }

  return {
    ...deck,
    name: url.searchParams.get('name') || '',
    source: 'ourygo',
  };
};

const encodeYdkeSection = cardIds => {
  const bytes = new Uint8Array(cardIds.length * 4);
  const view = new DataView(bytes.buffer);
  cardIds.forEach((cardId, index) => {
    if (!CARD_ID_PATTERN.test(String(cardId))) {
      throw new Error(`无法导出无效卡号：${cardId}`);
    }
    const value = Number(cardId);
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw new Error(`卡号超出 YDKe 支持范围：${cardId}`);
    }
    view.setUint32(index * 4, value, true);
  });
  return encodeBase64(bytes);
};

export const serializeYdke = deck => {
  const serializable = section =>
    (deck[section] || []).filter(id => CARD_ID_PATTERN.test(String(id)));
  return `ydke://${encodeYdkeSection(serializable('main'))}!` +
    `${encodeYdkeSection(serializable('extra'))}!` +
    `${encodeYdkeSection(serializable('side'))}!`;
};

export const serializeYdk = (deck, creator = 'Better YGO') => {
  const serializable = section =>
    (deck[section] || []).filter(id => CARD_ID_PATTERN.test(String(id)));
  const lines = [
    `#created by ${creator}`,
    '#main',
    ...serializable('main'),
    '#extra',
    ...serializable('extra'),
    '!side',
    ...serializable('side'),
  ];
  return `${lines.join('\n')}\n`;
};

export const parseYdk = input => {
  const deck = emptyDeck();
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length > MAX_YDK_LINES) {
    throw new Error(`YDK 内容不能超过 ${MAX_YDK_LINES} 行`);
  }

  let section = null;
  lines.forEach((line, index) => {
    const value = line.trim();
    if (!value) {
      return;
    }

    const nextSection = SECTION_MARKER_MAP.get(value.toLowerCase());
    if (nextSection) {
      section = nextSection;
      return;
    }
    if (value.startsWith('#') || value.startsWith('!')) {
      return;
    }
    if (!CARD_ID_PATTERN.test(value)) {
      deck.warnings.push(`第 ${index + 1} 行不是有效卡号：${value}`);
      return;
    }
    if (!section) {
      deck.warnings.push(`第 ${index + 1} 行位于卡组分区之前，已忽略`);
      return;
    }
    deck[section].push(value);
  });

  return deck;
};

export const parseDeckInput = input => {
  const normalized = input.trim();
  if (!normalized) {
    throw new Error('请输入 YDK 内容、YDKe 卡组码或卡组链接');
  }
  if (normalized.toLowerCase().startsWith('ydke://')) {
    return parseYdke(normalized);
  }
  if (/^https?:\/\//i.test(normalized)) {
    return parseOurygoDeckUrl(normalized);
  }
  return parseYdk(normalized);
};

export const flattenDeck = (deck, sections = ['main', 'extra', 'side']) => {
  return sections.flatMap(section => deck[section] || []);
};

export const mergeDecks = (current, incoming) => ({
  main: [...(current?.main || []), ...(incoming?.main || [])],
  extra: [...(current?.extra || []), ...(incoming?.extra || [])],
  side: [...(current?.side || []), ...(incoming?.side || [])],
  warnings: [
    ...(current?.warnings || []),
    ...(incoming?.warnings || []),
  ],
});

export const summarizeDeck = deck => {
  const all = flattenDeck(deck);
  return {
    main: deck.main.length,
    extra: deck.extra.length,
    side: deck.side.length,
    total: all.length,
    unique: new Set(all).size,
  };
};
