import { isExtraDeckCardType } from '../print/card-adapter.js';

export const CUSTOM_CARD_PREFIX = 'custom:';

const clone = value => JSON.parse(JSON.stringify(value));

const createCustomId = () => {
  const value = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${CUSTOM_CARD_PREFIX}${value}`;
};

export const isCustomCardId = value =>
  String(value || '').startsWith(CUSTOM_CARD_PREFIX);

export const getCustomCard = (customCards, id) => {
  if (!isCustomCardId(id)) return null;
  return customCards?.[String(id)] || null;
};

export const getCustomCardDefaultSection = card => {
  return isExtraDeckCardType(card?.data?.cardType) ? 'extra' : 'main';
};

export const createCustomCard = (data, options = {}) => {
  const requestedId = String(options.id || '');
  const id = isCustomCardId(requestedId) ? requestedId : createCustomId();
  return {
    id,
    name: String(data?.name || options.name || '未命名原创卡'),
    cardKind: options.cardKind || 'yugioh',
    sourceCardId: String(options.sourceCardId || ''),
    data: clone(data || {}),
    updatedAt: new Date().toISOString(),
  };
};

export const customCardToResolved = card => ({
  id: card.id,
  baseId: card.id,
  artworkId: card.id,
  name: card.name,
  metadata: {
    id: card.id,
    custom: true,
    text: { types: '原创卡' },
  },
  rendererData: clone(card.data),
  prerelease: false,
  alternateArtwork: false,
  custom: true,
  renderMode: 'redraw',
  source: 'custom',
  defaultSection: getCustomCardDefaultSection(card),
});

export const writeCustomCardToDeck = (
  project,
  card,
  options = {},
) => {
  const section = options.section || getCustomCardDefaultSection(card);
  const mode = options.mode === 'add' ? 'add' : 'replace';
  const sourceId = String(options.sourceId || '');
  const nextDeck = {
    main: [...(project?.deck?.main || [])],
    extra: [...(project?.deck?.extra || [])],
    side: [...(project?.deck?.side || [])],
  };

  if (mode === 'add') {
    nextDeck[section].push(card.id);
  } else {
    let replaced = false;
    nextDeck[section] = nextDeck[section].map(id => {
      if (String(id) !== sourceId) return id;
      replaced = true;
      return card.id;
    });
    if (!replaced) {
      nextDeck[section].push(card.id);
    }
  }

  return {
    ...project,
    kind: 'deck',
    deck: nextDeck,
    customCards: {
      ...(project?.customCards || {}),
      [card.id]: clone(card),
    },
  };
};

export const addCustomCardsToDeck = (project, cards) => {
  return cards.reduce((current, card) => writeCustomCardToDeck(
    current,
    card,
    {
      mode: 'add',
      section: getCustomCardDefaultSection(card),
    },
  ), project);
};
