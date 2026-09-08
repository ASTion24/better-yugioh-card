import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDrawDistribution,
  calculateGoalProbability,
  calculateRoleProbability,
  combination,
  drawTestHand,
  goalMatchesHand,
  probabilityAtLeastOne,
  redrawUnlockedHand,
  swapHandCard,
} from '../probability.js';

test('combination and opening probabilities use exact draws without replacement', () => {
  assert.equal(combination(5, 2), 10);
  assert.equal(combination(5, 6), 0);
  assert.ok(Math.abs(
    probabilityAtLeastOne(40, 3, 5) - 0.3375506073,
  ) < 1e-9);
});

test('going-second probability separates first five and sixth-card increment', () => {
  const result = calculateRoleProbability(40, 3);
  assert.ok(Math.abs(result.firstFive - 0.3375506073) < 1e-9);
  assert.ok(Math.abs(result.goingSecond - 0.3943319838) < 1e-9);
  assert.ok(Math.abs(
    result.firstFive + result.sixthOnly - result.goingSecond,
  ) < 1e-12);
});

test('draw distribution separates zero, one, two and three-plus copies', () => {
  const result = calculateDrawDistribution(40, 3, 5);
  assert.ok(Math.abs(
    result.zero + result.one + result.two + result.threePlus - 1,
  ) < 1e-12);
  assert.ok(Math.abs(result.zero - (1 - 0.3375506073)) < 1e-9);
  assert.ok(result.one > result.two);
  assert.ok(result.two > result.threePlus);
});

test('draw test separates the sixth draw from the opening five', () => {
  const values = [0, 0, 0, 0, 0, 0];
  const deck = ['1', '2', '3', '4', '5', '6'];
  const hand = drawTestHand(deck, {
    goingSecond: true,
    random: () => values.shift() ?? 0,
  });
  assert.equal(hand.firstFive.length, 5);
  assert.ok(hand.sixth);
  assert.equal(new Set([...hand.firstFive, hand.sixth]).size, 6);
});

test('combination goals account for overlapping roles exactly', () => {
  const deck = [
    ...Array.from({ length: 3 }, () => 'starter'),
    ...Array.from({ length: 3 }, () => 'extender'),
    ...Array.from({ length: 2 }, () => 'both'),
    ...Array.from({ length: 32 }, (_, index) => `other-${index}`),
  ];
  const assignments = {
    starter: ['starter'],
    extender: ['extender'],
    both: ['starter', 'extender'],
  };
  const goal = {
    mode: 'all',
    conditions: [
      { roleId: 'starter', comparator: 'atLeast', count: 1 },
      { roleId: 'extender', comparator: 'atLeast', count: 1 },
    ],
  };
  const expected = 1 -
    2 * combination(35, 5) / combination(40, 5) +
    combination(32, 5) / combination(40, 5);
  const result = calculateGoalProbability(deck, assignments, goal);
  assert.ok(Math.abs(result.firstFive - expected) < 1e-12);
  const anyResult = calculateGoalProbability(deck, assignments, {
    ...goal,
    mode: 'any',
  });
  const expectedAny = 1 - combination(32, 5) / combination(40, 5);
  assert.ok(Math.abs(anyResult.firstFive - expectedAny) < 1e-12);
  assert.equal(
    goalMatchesHand(['both', 'other-1'], assignments, goal),
    true,
  );
});

test('at-most and any goals use exact finite-deck probabilities', () => {
  const deck = [
    ...Array.from({ length: 6 }, () => 'brick'),
    ...Array.from({ length: 34 }, (_, index) => `other-${index}`),
  ];
  const goal = {
    mode: 'all',
    conditions: [
      { roleId: 'brick', comparator: 'atMost', count: 1 },
    ],
  };
  const expected = (
    combination(34, 5) +
    6 * combination(34, 4)
  ) / combination(40, 5);
  const result = calculateGoalProbability(deck, { brick: ['brick'] }, goal);
  assert.ok(Math.abs(result.firstFive - expected) < 1e-12);
  assert.ok(result.sixthDelta < 0);
});

test('locked redraws and single swaps preserve card counts', () => {
  const deck = ['1', '2', '3', '4', '5', '6', '7'];
  const hand = {
    firstFive: ['1', '2', '3', '4', '5'],
    sixth: '6',
    remaining: ['7'],
  };
  const redrawn = redrawUnlockedHand(
    deck,
    hand,
    ['opening-0', 'sixth'],
    { random: () => 0 },
  );
  assert.equal(redrawn.firstFive[0], '1');
  assert.equal(redrawn.sixth, '6');
  assert.equal(new Set([
    ...redrawn.firstFive,
    redrawn.sixth,
    ...redrawn.remaining,
  ]).size, 7);

  const swapped = swapHandCard(hand, 'opening-0', () => 0);
  assert.equal(swapped.firstFive[0], '7');
  assert.ok(swapped.remaining.includes('1'));
});
