import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySidePlan,
  compareDecks,
  createAnalysisPreset,
  createDeckSnapshot,
  diagnoseGoalFailures,
  getMissingCards,
  normalizeAnalysis,
  validateSidePlan,
} from '../analysis.js';

test('analysis state normalizes snapshots, side plans and metadata', () => {
  const analysis = normalizeAnalysis({
    snapshots: [{ name: '版本 A', deck: { main: [1], extra: [], side: [] } }],
    sidePlans: [{
      name: '后攻',
      mode: 'second',
      swaps: [{ outId: 1, inId: 2, count: 9 }],
    }],
    inventory: { enabled: true, counts: { 1: 2, 2: 0 } },
    metadata: { format: 'tcg', tags: ['比赛', '比赛', '  '] },
  });
  assert.deepEqual(analysis.snapshots[0].deck.main, ['1']);
  assert.equal(analysis.sidePlans[0].swaps[0].count, 3);
  assert.deepEqual(analysis.inventory.counts, { 1: 2 });
  assert.deepEqual(analysis.metadata.tags, ['比赛']);
});

test('deck snapshots stay lightweight and compare section changes', () => {
  const snapshot = createDeckSnapshot({
    deck: { main: ['1', '1', '2'], extra: ['8'], side: ['9'] },
    roles: { 1: ['starter'] },
    goals: [],
  }, '初版');
  const diff = compareDecks(
    { main: ['1', '2', '3'], extra: ['8'], side: ['1', '9'] },
    snapshot.deck,
  );
  assert.deepEqual(diff.main.added, [{ id: '3', count: 1 }]);
  assert.deepEqual(diff.main.removed, [{ id: '1', count: 1 }]);
  assert.deepEqual(diff.side.added, [{ id: '1', count: 1 }]);
  assert.equal(Object.hasOwn(snapshot, 'customCards'), false);
});

test('side plans validate availability and exchange cards without changing sizes', () => {
  const deck = {
    main: ['1', '1', '2'],
    extra: ['8'],
    side: ['3', '3', '9'],
  };
  const plan = {
    name: '后攻方案',
    swaps: [
      { outId: '1', outSection: 'main', inId: '3', count: 2 },
      { outId: '8', outSection: 'extra', inId: '9', count: 1 },
    ],
  };
  assert.deepEqual(validateSidePlan(deck, plan), []);
  const result = applySidePlan(deck, plan);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.deck.main, ['2', '3', '3']);
  assert.deepEqual(result.deck.extra, ['9']);
  assert.deepEqual(result.deck.side.sort(), ['1', '1', '8'].sort());
  assert.ok(validateSidePlan(deck, {
    swaps: [{ outId: '2', inId: '3', count: 3 }],
  }).length);
});

test('inventory and goal diagnostics expose actionable shortages', () => {
  assert.deepEqual(getMissingCards(
    { main: ['1', '1', '2'], extra: [], side: ['3'] },
    { enabled: true, counts: { 1: 1, 3: 1 } },
  ), [
    { id: '1', required: 2, owned: 1, missing: 1 },
    { id: '2', required: 1, owned: 0, missing: 1 },
  ]);
  const diagnosis = diagnoseGoalFailures(
    [
      { mode: 'first', firstFive: ['a', 'x'], sixth: '' },
      { mode: 'second', firstFive: ['b'], sixth: 'x' },
    ],
    { a: ['starter'], b: ['brick'] },
    {
      mode: 'all',
      conditions: [
        { roleId: 'starter', comparator: 'atLeast', count: 1 },
        { roleId: 'brick', comparator: 'atMost', count: 0 },
      ],
    },
    [
      { id: 'starter', label: '初动' },
      { id: 'brick', label: '废件' },
    ],
  );
  assert.equal(diagnosis.failedHands, 1);
  assert.deepEqual(
    diagnosis.reasons.map(reason => reason.label),
    ['初动不足 1 张', '废件超过 0 张'],
  );
  assert.ok(createAnalysisPreset({ roles: {}, goals: [] }, '通用').id);
});
