import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptYgocdbCard,
  decodeLevel,
  decodeLinkArrows,
  decodePendulumScale,
  isExtraDeckCardType,
  normalizeCardDescription,
} from '../card-adapter.js';

test('packed level data decodes level and pendulum scale', () => {
  assert.equal(decodeLevel(0x04040007), 7);
  assert.equal(decodePendulumScale(0x04040007), 4);
});

test('link marker bits map to renderer arrow indexes', () => {
  assert.deepEqual(decodeLinkArrows(0x100 | 0x20 | 0x1), [2, 3, 6]);
});

test('first-line compression is reserved for extra deck monster types', () => {
  for (const cardType of ['fusion', 'synchro', 'xyz', 'link']) {
    assert.equal(isExtraDeckCardType(cardType), true);
  }
  for (const cardType of ['normal', 'effect', 'ritual', 'token']) {
    assert.equal(isExtraDeckCardType(cardType), false);
  }
});

test('extra deck descriptions keep only the summon condition on its own line', () => {
  const description = [
    '7星「升辉月」怪兽×2',
    '这个卡名的①②效果1回合各能使用1次。',
    '①：这张卡特殊召唤的场合才能发动。',
    '②：这张卡被送去墓地的场合才能发动。',
  ].join('\r\n');
  const expected = [
    '7星「升辉月」怪兽×2',
    '这个卡名的①②效果1回合各能使用1次。①：这张卡特殊召唤的场合才能发动。②：这张卡被送去墓地的场合才能发动。',
  ].join('\n');

  for (const cardType of ['fusion', 'synchro', 'xyz', 'link']) {
    assert.equal(normalizeCardDescription(description, cardType), expected);
  }
});

test('non-extra-deck and pendulum descriptions ignore every explicit line break', () => {
  const description = '这个卡名的效果1回合只能使用1次。\n①：效果一。\n\n②：效果二。';
  const expected = '这个卡名的效果1回合只能使用1次。①：效果一。②：效果二。';

  assert.equal(normalizeCardDescription(description, 'effect'), expected);
  assert.equal(normalizeCardDescription(description, 'ritual'), expected);
  assert.equal(normalizeCardDescription(description), expected);
});

test('pendulum monster records map to high-resolution renderer data', () => {
  const result = adaptYgocdbCard({
    id: 89631139,
    sc_name: '娱乐伙伴 异色眼融解者',
    data: {
      type: 0x1000021,
      level: 0x04040007,
      race: 0x2,
      attribute: 0x10,
      atk: 2000,
      def: 2600,
    },
    text: {
      pdesc: '灵摆效果一。\n灵摆效果二。',
      desc: '怪兽效果一。\n怪兽效果二。',
    },
  }, 'art.jpg');

  assert.equal(result.type, 'pendulum');
  assert.equal(result.cardType, 'effect');
  assert.equal(result.pendulumType, 'effect-pendulum');
  assert.equal(result.level, 7);
  assert.equal(result.pendulumScale, 4);
  assert.equal(result.attribute, 'light');
  assert.equal(result.monsterType, '魔法师族/灵摆/效果');
  assert.equal(result.image, 'art.jpg');
  assert.equal(result.pendulumDescription, '灵摆效果一。灵摆效果二。');
  assert.equal(result.description, '怪兽效果一。怪兽效果二。');
  assert.equal(result.firstLineCompress, false);
});

test('link and continuous spell records map their specialized fields', () => {
  const link = adaptYgocdbCard({
    id: 1,
    sc_name: '连接怪兽',
    data: {
      type: 0x4000021,
      level: 0,
      race: 0x1000000,
      attribute: 0x20,
      atk: 2300,
      def: 0x100 | 0x20,
    },
    text: { desc: '效果' },
  }, 'link.jpg');
  assert.equal(link.cardType, 'link');
  assert.deepEqual(link.arrowList, [2, 3]);
  assert.equal(link.monsterType, '电子界族/连接/效果');
  assert.equal(link.firstLineCompress, true);

  const spell = adaptYgocdbCard({
    id: 2,
    sc_name: '永续魔法',
    data: { type: 0x2 | 0x20000 },
    text: { desc: '效果' },
  }, 'spell.jpg');
  assert.equal(spell.type, 'spell');
  assert.equal(spell.icon, 'continuous');
  assert.equal(spell.firstLineCompress, false);
});
