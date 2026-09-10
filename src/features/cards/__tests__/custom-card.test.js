import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCustomCardsToDeck,
  createCustomCard,
  createFullCardImage,
  customCardToResolved,
  getFullCardImageSource,
  getCustomCardDefaultSection,
  isCustomCardId,
  isFullCardImage,
  writeCustomCardToDeck,
} from '../custom-card.js';
import { renderCustomCardThumbnail } from '../custom-card-render.js';

const project = {
  id: 'deck-1',
  kind: 'deck',
  deck: {
    main: ['89631139', '89631139'],
    extra: [],
    side: [],
  },
  customCards: {},
};

test('custom cards keep renderer data and infer their deck section', () => {
  const card = createCustomCard({
    name: '原创融合',
    type: 'monster',
    cardType: 'fusion',
  }, { id: 'custom:fusion-1', sourceCardId: '89631139' });
  assert.equal(isCustomCardId(card.id), true);
  assert.equal(getCustomCardDefaultSection(card), 'extra');
  const resolved = customCardToResolved(card);
  assert.equal(resolved.name, '原创融合');
  assert.equal(resolved.source, 'custom');
  assert.equal(resolved.defaultSection, 'extra');
});

test('edited cards can replace every copy or append as a new card', () => {
  const replacement = createCustomCard({
    name: '编辑后的青眼白龙',
    type: 'monster',
    cardType: 'normal',
  }, { id: 'custom:edited-blue-eyes' });
  const replaced = writeCustomCardToDeck(project, replacement, {
    section: 'main',
    sourceId: '89631139',
    mode: 'replace',
  });
  assert.deepEqual(replaced.deck.main, [
    'custom:edited-blue-eyes',
    'custom:edited-blue-eyes',
  ]);
  assert.equal(replaced.customCards[replacement.id].name, '编辑后的青眼白龙');

  const appended = writeCustomCardToDeck(project, replacement, {
    section: 'main',
    sourceId: '89631139',
    mode: 'add',
  });
  assert.deepEqual(appended.deck.main, [
    '89631139',
    '89631139',
    'custom:edited-blue-eyes',
  ]);
});

test('batch custom cards are added to their inferred sections', () => {
  const main = createCustomCard({
    name: '主卡原创',
    type: 'spell',
    cardType: 'effect',
  }, { id: 'custom:main-1' });
  const extra = createCustomCard({
    name: '额外原创',
    type: 'monster',
    cardType: 'xyz',
  }, { id: 'custom:extra-1' });
  const updated = addCustomCardsToDeck(project, [main, extra]);
  assert.equal(updated.deck.main.at(-1), main.id);
  assert.equal(updated.deck.extra.at(-1), extra.id);
});

test('temporary full-card images preserve their original printable source', async () => {
  const source = 'data:image/png;base64,iVBORw0KGgo=';
  const card = createFullCardImage(source, {
    id: 'custom:image:test-card',
    name: '临时测试卡',
    fileName: '临时测试卡.png',
    mimeType: 'image/png',
    width: 1394,
    height: 2031,
    bytes: 4096,
  });

  assert.equal(isFullCardImage(card), true);
  assert.equal(getFullCardImageSource(card), source);
  assert.equal(getCustomCardDefaultSection(card), 'main');
  assert.equal(card.imageMeta.width, 1394);
  assert.equal(customCardToResolved(card).source, 'full-card-image');
  assert.equal(await renderCustomCardThumbnail(card), source);
});
