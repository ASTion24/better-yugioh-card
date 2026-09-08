const clampInteger = (value, minimum, maximum) => {
  return Math.min(maximum, Math.max(minimum, Math.trunc(Number(value) || 0)));
};

export const combination = (total, selected) => {
  const n = Math.trunc(Number(total));
  const k = Math.trunc(Number(selected));
  if (n < 0 || k < 0 || k > n) return 0;
  const size = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= size; index += 1) {
    result = result * (n - size + index) / index;
  }
  return result;
};

export const probabilityAtLeastOne = (deckSize, copies, drawCount) => {
  const total = Math.max(0, Math.trunc(Number(deckSize) || 0));
  if (!total) return 0;
  const hits = clampInteger(copies, 0, total);
  const draws = clampInteger(drawCount, 0, total);
  if (!hits || !draws) return 0;
  if (draws > total - hits) return 1;
  return 1 - combination(total - hits, draws) /
    combination(total, draws);
};

export const probabilityExactly = (
  deckSize,
  copies,
  drawCount,
  hitsDrawn,
) => {
  const total = Math.max(0, Math.trunc(Number(deckSize) || 0));
  const hits = clampInteger(copies, 0, total);
  const draws = clampInteger(drawCount, 0, total);
  const selectedHits = Math.trunc(Number(hitsDrawn) || 0);
  if (selectedHits < 0 || selectedHits > hits || selectedHits > draws) return 0;
  const misses = draws - selectedHits;
  if (misses > total - hits) return 0;
  const totalWays = combination(total, draws);
  if (!totalWays) return 0;
  return combination(hits, selectedHits) *
    combination(total - hits, misses) /
    totalWays;
};

export const calculateDrawDistribution = (
  deckSize,
  copies,
  drawCount,
) => {
  const total = Math.max(0, Math.trunc(Number(deckSize) || 0));
  const hits = clampInteger(copies, 0, total);
  const draws = clampInteger(drawCount, 0, total);
  const zero = probabilityExactly(total, hits, draws, 0);
  const one = probabilityExactly(total, hits, draws, 1);
  const two = probabilityExactly(total, hits, draws, 2);
  return {
    drawCount: draws,
    zero,
    one,
    two,
    threePlus: Math.max(0, 1 - zero - one - two),
  };
};

export const calculateRoleProbability = (deckSize, copies) => {
  const total = Math.max(0, Math.trunc(Number(deckSize) || 0));
  const hits = clampInteger(copies, 0, total);
  const openingDraws = Math.min(5, total);
  const firstFive = probabilityAtLeastOne(total, hits, openingDraws);
  const goingSecond = probabilityAtLeastOne(
    total,
    hits,
    Math.min(6, total),
  );
  return {
    deckSize: total,
    copies: hits,
    firstFive,
    sixthOnly: Math.max(0, goingSecond - firstFive),
    goingSecond,
  };
};

const normalizeGoalConditions = goal => {
  return (Array.isArray(goal?.conditions) ? goal.conditions : [])
    .map(condition => ({
      roleId: String(condition?.roleId || ''),
      comparator: condition?.comparator === 'atMost'
        ? 'atMost'
        : 'atLeast',
      count: clampInteger(condition?.count, 0, 6),
    }))
    .filter(condition => condition.roleId);
};

const goalMatchesCounts = (goal, roleIds, counts) => {
  const conditions = normalizeGoalConditions(goal);
  if (!conditions.length) return false;
  const matches = conditions.map(condition => {
    const roleIndex = roleIds.indexOf(condition.roleId);
    const count = roleIndex < 0 ? 0 : counts[roleIndex];
    return condition.comparator === 'atMost'
      ? count <= condition.count
      : count >= condition.count;
  });
  return goal?.mode === 'any'
    ? matches.some(Boolean)
    : matches.every(Boolean);
};

export const goalMatchesHand = (
  cardIds,
  assignments,
  goal,
) => {
  const conditions = normalizeGoalConditions(goal);
  const roleIds = [...new Set(
    conditions.map(condition => condition.roleId),
  )];
  const counts = roleIds.map(roleId => cardIds.reduce((total, cardId) =>
    total + Number(Boolean(
      assignments?.[String(cardId)]?.includes(roleId),
    )), 0));
  return goalMatchesCounts(goal, roleIds, counts);
};

const calculateGoalForDraw = (
  cardIds,
  assignments,
  goal,
  drawCount,
) => {
  const total = cardIds.length;
  const draws = clampInteger(drawCount, 0, total);
  const conditions = normalizeGoalConditions(goal);
  if (!total || !draws || !conditions.length) return 0;
  const roleIds = [...new Set(
    conditions.map(condition => condition.roleId),
  )];
  const caps = roleIds.map(roleId => conditions
    .filter(condition => condition.roleId === roleId)
    .reduce((maximum, condition) => Math.max(
      maximum,
      condition.comparator === 'atMost'
        ? condition.count + 1
        : condition.count,
    ), 0));
  const states = Array.from(
    { length: draws + 1 },
    () => new Map(),
  );
  const emptyCounts = roleIds.map(() => 0);
  states[0].set(emptyCounts.join(','), 1);

  cardIds.forEach(cardId => {
    const roles = new Set(assignments?.[String(cardId)] || []);
    for (let selected = draws - 1; selected >= 0; selected -= 1) {
      for (const [key, ways] of [...states[selected]]) {
        const counts = key.split(',').map(Number);
        const nextCounts = counts.map((count, index) =>
          roles.has(roleIds[index])
            ? Math.min(caps[index], count + 1)
            : count);
        const nextKey = nextCounts.join(',');
        states[selected + 1].set(
          nextKey,
          (states[selected + 1].get(nextKey) || 0) + ways,
        );
      }
    }
  });

  const successfulWays = [...states[draws]].reduce(
    (totalWays, [key, ways]) => {
      const counts = key.split(',').map(Number);
      return goalMatchesCounts(goal, roleIds, counts)
        ? totalWays + ways
        : totalWays;
    },
    0,
  );
  return successfulWays / combination(total, draws);
};

export const calculateGoalProbability = (
  cardIds,
  assignments,
  goal,
) => {
  const firstFive = calculateGoalForDraw(
    cardIds,
    assignments,
    goal,
    Math.min(5, cardIds.length),
  );
  const goingSecond = calculateGoalForDraw(
    cardIds,
    assignments,
    goal,
    Math.min(6, cardIds.length),
  );
  return {
    firstFive,
    goingSecond,
    sixthDelta: goingSecond - firstFive,
  };
};

const defaultRandom = () => {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] / 0x100000000;
  }
  return Math.random();
};

export const shuffleDeck = (cardIds, random = defaultRandom) => {
  const cards = [...cardIds];
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [cards[index], cards[target]] = [cards[target], cards[index]];
  }
  return cards;
};

export const drawTestHand = (cardIds, options = {}) => {
  const shuffled = shuffleDeck(cardIds, options.random);
  const firstFive = shuffled.slice(0, 5);
  return {
    firstFive,
    sixth: options.goingSecond ? shuffled[5] || '' : '',
    remaining: shuffled.slice(options.goingSecond ? 6 : 5),
  };
};

const removeCardOnce = (cardIds, cardId) => {
  const index = cardIds.indexOf(cardId);
  if (index >= 0) cardIds.splice(index, 1);
};

export const redrawUnlockedHand = (
  cardIds,
  hand,
  lockedSlots,
  options = {},
) => {
  const goingSecond = Boolean(hand?.sixth);
  const slotIds = [
    ...(hand?.firstFive || []),
    ...(goingSecond ? [hand.sixth] : []),
  ];
  const locked = new Set(lockedSlots || []);
  const available = [...cardIds];
  slotIds.forEach((cardId, index) => {
    const slot = index < 5 ? `opening-${index}` : 'sixth';
    if (locked.has(slot)) removeCardOnce(available, cardId);
  });
  const replacements = shuffleDeck(available, options.random);
  const nextSlots = slotIds.map((cardId, index) => {
    const slot = index < 5 ? `opening-${index}` : 'sixth';
    return locked.has(slot) ? cardId : replacements.shift() || '';
  });
  return {
    firstFive: nextSlots.slice(0, 5).filter(Boolean),
    sixth: goingSecond ? nextSlots[5] || '' : '',
    remaining: replacements,
  };
};

export const swapHandCard = (hand, slot, random = defaultRandom) => {
  if (!hand?.remaining?.length) return hand;
  const replacements = shuffleDeck(hand.remaining, random);
  const replacement = replacements.shift();
  const firstFive = [...hand.firstFive];
  let replaced = '';
  let sixth = hand.sixth;
  if (slot === 'sixth') {
    replaced = sixth;
    sixth = replacement;
  } else {
    const index = Number(String(slot).replace('opening-', ''));
    if (!Number.isInteger(index) || !firstFive[index]) return hand;
    replaced = firstFive[index];
    firstFive[index] = replacement;
  }
  if (replaced) replacements.push(replaced);
  return {
    firstFive,
    sixth,
    remaining: replacements,
  };
};
