const TYPE = {
  MONSTER: 0x1,
  SPELL: 0x2,
  TRAP: 0x4,
  NORMAL: 0x10,
  EFFECT: 0x20,
  FUSION: 0x40,
  RITUAL: 0x80,
  SPIRIT: 0x200,
  UNION: 0x400,
  GEMINI: 0x800,
  TUNER: 0x1000,
  SYNCHRO: 0x2000,
  TOKEN: 0x4000,
  QUICK_PLAY: 0x10000,
  CONTINUOUS: 0x20000,
  EQUIP: 0x40000,
  FIELD: 0x80000,
  COUNTER: 0x100000,
  FLIP: 0x200000,
  TOON: 0x400000,
  XYZ: 0x800000,
  PENDULUM: 0x1000000,
  LINK: 0x4000000,
};

const ATTRIBUTE_MAP = {
  0x1: 'earth',
  0x2: 'water',
  0x4: 'fire',
  0x8: 'wind',
  0x10: 'light',
  0x20: 'dark',
  0x40: 'divine',
};

const RACE_MAP = {
  0x1: '战士',
  0x2: '魔法师',
  0x4: '天使',
  0x8: '恶魔',
  0x10: '不死',
  0x20: '机械',
  0x40: '水',
  0x80: '炎',
  0x100: '岩石',
  0x200: '鸟兽',
  0x400: '植物',
  0x800: '昆虫',
  0x1000: '雷',
  0x2000: '龙',
  0x4000: '兽',
  0x8000: '兽战士',
  0x10000: '恐龙',
  0x20000: '鱼',
  0x40000: '海龙',
  0x80000: '爬虫类',
  0x100000: '念动力',
  0x200000: '幻神兽',
  0x400000: '创造神',
  0x800000: '幻龙',
  0x1000000: '电子界',
  0x2000000: '幻想魔',
};

const LINK_MARKER_MAP = [
  [0x80, 1],
  [0x100, 2],
  [0x20, 3],
  [0x4, 4],
  [0x2, 5],
  [0x1, 6],
  [0x8, 7],
  [0x40, 8],
];

const hasType = (type, flag) => (type & flag) !== 0;

const EXTRA_DECK_CARD_TYPES = new Set(['fusion', 'synchro', 'xyz', 'link']);

export const isExtraDeckCardType = cardType => EXTRA_DECK_CARD_TYPES.has(cardType);

export const decodeLevel = packedLevel => Number(packedLevel) & 0xff;

export const decodePendulumScale = packedLevel => {
  const value = Number(packedLevel) >>> 0;
  return (value >>> 24) & 0xff || (value >>> 16) & 0xff;
};

export const decodeLinkArrows = markerValue => {
  const value = Number(markerValue) >>> 0;
  return LINK_MARKER_MAP
    .filter(([marker]) => (value & marker) !== 0)
    .map(([, arrow]) => arrow);
};

const getCardType = type => {
  if (hasType(type, TYPE.LINK)) return 'link';
  if (hasType(type, TYPE.XYZ)) return 'xyz';
  if (hasType(type, TYPE.SYNCHRO)) return 'synchro';
  if (hasType(type, TYPE.FUSION)) return 'fusion';
  if (hasType(type, TYPE.RITUAL)) return 'ritual';
  if (hasType(type, TYPE.TOKEN)) return 'token';
  if (hasType(type, TYPE.NORMAL) && !hasType(type, TYPE.EFFECT)) return 'normal';
  return 'effect';
};

const getPendulumType = type => `${getCardType(type)}-pendulum`;

const getSpellTrapIcon = type => {
  if (hasType(type, TYPE.QUICK_PLAY)) return 'quick-play';
  if (hasType(type, TYPE.CONTINUOUS)) return 'continuous';
  if (hasType(type, TYPE.EQUIP)) return 'equip';
  if (hasType(type, TYPE.FIELD)) return 'field';
  if (hasType(type, TYPE.COUNTER)) return 'counter';
  if (hasType(type, TYPE.RITUAL)) return 'ritual';
  return '';
};

const getMonsterType = (type, race) => {
  const values = [`${RACE_MAP[race] || '怪兽'}族`];
  const subtypeList = [
    [TYPE.RITUAL, '仪式'],
    [TYPE.FUSION, '融合'],
    [TYPE.SYNCHRO, '同调'],
    [TYPE.XYZ, '超量'],
    [TYPE.LINK, '连接'],
    [TYPE.SPIRIT, '灵魂'],
    [TYPE.UNION, '同盟'],
    [TYPE.GEMINI, '二重'],
    [TYPE.TUNER, '调整'],
    [TYPE.FLIP, '反转'],
    [TYPE.TOON, '卡通'],
    [TYPE.PENDULUM, '灵摆'],
    [TYPE.TOKEN, '衍生物'],
  ];
  subtypeList.forEach(([flag, label]) => {
    if (hasType(type, flag)) {
      values.push(label);
    }
  });
  if (!hasType(type, TYPE.TOKEN)) {
    values.push(hasType(type, TYPE.NORMAL) && !hasType(type, TYPE.EFFECT) ? '通常' : '效果');
  }
  return values.join('/');
};

const getDisplayName = card => {
  return card.sc_name || card.cn_name || card.md_name || card.nwbbs_n || card.jp_name || card.en_name || String(card.id);
};

const formatPassword = cardId => {
  const value = String(cardId);
  return value.length < 8 ? value.padStart(8, '0') : value;
};

export const normalizeCardDescription = (description, cardType) => {
  const lines = String(description || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (isExtraDeckCardType(cardType) && lines.length > 1) {
    return `${lines[0]}\n${lines.slice(1).join('')}`;
  }
  return lines.join('');
};

export const adaptYgocdbCard = (card, image) => {
  const raw = card.data || {};
  const text = card.text || {};
  const typeValue = Number(raw.type) || 0;
  const isSpell = hasType(typeValue, TYPE.SPELL);
  const isTrap = hasType(typeValue, TYPE.TRAP);
  const isPendulum = hasType(typeValue, TYPE.PENDULUM);
  const cardType = getCardType(typeValue);
  const level = decodeLevel(raw.level);

  return {
    language: 'sc',
    name: getDisplayName(card),
    type: isSpell ? 'spell' : isTrap ? 'trap' : isPendulum ? 'pendulum' : 'monster',
    attribute: ATTRIBUTE_MAP[raw.attribute] || '',
    icon: getSpellTrapIcon(typeValue),
    image,
    cardType,
    pendulumType: getPendulumType(typeValue),
    level: cardType === 'xyz' ? 0 : level,
    rank: cardType === 'xyz' ? level : 0,
    pendulumScale: decodePendulumScale(raw.level),
    pendulumDescription: normalizeCardDescription(text.pdesc),
    monsterType: getMonsterType(typeValue, raw.race),
    atk: Number.isFinite(raw.atk) ? raw.atk : -1,
    def: Number.isFinite(raw.def) ? raw.def : -1,
    arrowList: cardType === 'link' ? decodeLinkArrows(raw.def) : [],
    description: normalizeCardDescription(text.desc, cardType),
    firstLineCompress: !isSpell && !isTrap && isExtraDeckCardType(cardType),
    package: '',
    password: formatPassword(card.id),
    copyright: '',
    laser: '',
    rare: '',
    radius: false,
    scale: 1,
  };
};
