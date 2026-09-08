import assert from 'node:assert/strict';
import test from 'node:test';
import { BATCH_CSV_SAMPLE, parseBatchCards } from '../batch-parser.js';

test('batch CSV parser maps card fields onto renderer defaults', () => {
  const cards = parseBatchCards(BATCH_CSV_SAMPLE);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].name, '星海记录者');
  assert.equal(cards[0].level, 4);
  assert.equal(cards[0].atk, 1600);
  assert.equal(cards[1].type, 'spell');
  assert.equal(cards[1].language, 'sc');
});

test('batch CSV parser supports quoted commas, quotes and newlines', () => {
  const [card] = parseBatchCards(
    'name,description,firstLineCompress\n' +
    '"测试,卡片","第一行\n第二行""引号""",true',
  );
  assert.equal(card.name, '测试,卡片');
  assert.equal(card.description, '第一行\n第二行"引号"');
  assert.equal(card.firstLineCompress, true);
});

test('batch JSON parser accepts an object payload and enforces limits', () => {
  const cards = parseBatchCards(JSON.stringify({
    cards: [{ name: 'JSON 卡片', atk: 1000 }],
  }));
  assert.equal(cards[0].name, 'JSON 卡片');
  assert.equal(cards[0].atk, 1000);
  assert.throws(() => parseBatchCards(JSON.stringify({
    cards: Array.from({ length: 201 }, () => ({ name: '过量' })),
  })), /最多生成 200 张/);
});
