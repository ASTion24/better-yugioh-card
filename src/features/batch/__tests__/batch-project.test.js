import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendBatchCards,
  createBatchCard,
  resolvedCardToBatchCard,
  writeBatchCard,
} from '../batch-project.js';

test('resolved cards become editable batch drafts with source identity', () => {
  const card = resolvedCardToBatchCard({
    artworkId: '89631139',
    name: '青眼白龙',
    rendererData: {
      name: '青眼白龙',
      password: '89631139',
      type: 'monster',
    },
  });
  assert.equal(card.name, '青眼白龙');
  assert.equal(card.password, '89631139');
  assert.equal(card.sourceCardId, '89631139');
  assert.ok(card.batchId);
});

test('batch project writes replace or append cards without losing identity', () => {
  const original = createBatchCard(
    { name: '原卡', password: '1' },
    { batchId: 'batch-1', sourceCardId: '10' },
  );
  const project = appendBatchCards(
    { kind: 'batch', cards: [] },
    [original],
  );
  const replaced = writeBatchCard(project, {
    name: '精修卡',
    password: '2',
  }, {
    sourceId: 'batch-1',
  });
  assert.equal(replaced.cards.length, 1);
  assert.equal(replaced.cards[0].batchId, 'batch-1');
  assert.equal(replaced.cards[0].sourceCardId, '10');
  assert.equal(replaced.cards[0].name, '精修卡');

  const appended = writeBatchCard(replaced, {
    name: '副本',
    password: '3',
  }, {
    mode: 'add',
    sourceId: 'batch-1',
  });
  assert.equal(appended.cards.length, 2);
  assert.notEqual(appended.cards[1].batchId, 'batch-1');
});
