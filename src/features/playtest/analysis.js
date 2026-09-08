const clone = value => JSON.parse(JSON.stringify(value));

const clampInteger = (value, minimum, maximum) => {
  return Math.min(maximum, Math.max(minimum, Math.trunc(Number(value) || 0)));
};

const createId = prefix => {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const normalizeDeck = value => ({
  main: (value?.main || []).map(String),
  extra: (value?.extra || []).map(String),
  side: (value?.side || []).map(String),
});

const normalizeAssignments = value => Object.fromEntries(
  Object.entries(value || {}).map(([cardId, roleIds]) => [
    String(cardId),
    [...new Set(Array.isArray(roleIds) ? roleIds.map(String) : [])],
  ]).filter(([, roleIds]) => roleIds.length),
);

const normalizeRoles = value => (Array.isArray(value) ? value : [])
  .map(role => ({
    id: String(role?.id || ''),
    label: String(role?.label || '').trim().slice(0, 12),
    color: String(role?.color || ''),
  }))
  .filter(role => role.id && role.label);

const normalizeGoals = value => (Array.isArray(value) ? value : [])
  .map((goal, index) => ({
    id: String(goal?.id || `goal-${index + 1}`),
    name: String(goal?.name || `目标 ${index + 1}`).trim().slice(0, 24),
    mode: goal?.mode === 'any' ? 'any' : 'all',
    conditions: (Array.isArray(goal?.conditions) ? goal.conditions : [])
      .map(condition => ({
        roleId: String(condition?.roleId || ''),
        comparator: condition?.comparator === 'atMost'
          ? 'atMost'
          : 'atLeast',
        count: clampInteger(condition?.count, 0, 6),
      }))
      .filter(condition => condition.roleId)
      .slice(0, 6),
  }))
  .filter(goal => goal.id && goal.name);

const normalizeSnapshot = (snapshot, index) => ({
  id: String(snapshot?.id || `snapshot-${index + 1}`),
  name: String(snapshot?.name || `快照 ${index + 1}`).trim().slice(0, 32),
  createdAt: String(snapshot?.createdAt || ''),
  deck: normalizeDeck(snapshot?.deck),
  roles: normalizeAssignments(snapshot?.roles),
  customRoles: normalizeRoles(snapshot?.customRoles),
  goals: normalizeGoals(snapshot?.goals),
  activeGoalId: String(snapshot?.activeGoalId || ''),
});

const normalizeSidePlan = (plan, index) => ({
  id: String(plan?.id || `side-plan-${index + 1}`),
  name: String(plan?.name || `换备方案 ${index + 1}`).trim().slice(0, 32),
  mode: plan?.mode === 'first' ? 'first' : 'second',
  note: String(plan?.note || '').slice(0, 240),
  swaps: (Array.isArray(plan?.swaps) ? plan.swaps : [])
    .map(swap => ({
      outId: String(swap?.outId || ''),
      outSection: swap?.outSection === 'extra' ? 'extra' : 'main',
      inId: String(swap?.inId || ''),
      count: clampInteger(swap?.count, 1, 3),
    }))
    .filter(swap => swap.outId && swap.inId)
    .slice(0, 15),
});

const normalizeInventory = value => ({
  enabled: Boolean(value?.enabled),
  counts: Object.fromEntries(
    Object.entries(value?.counts || {})
      .map(([cardId, count]) => [
        String(cardId),
        clampInteger(count, 0, 99),
      ])
      .filter(([, count]) => count > 0),
  ),
});

const normalizeMetadata = value => ({
  format: ['ocg', 'tcg', 'master-duel', 'custom'].includes(value?.format)
    ? value.format
    : 'ocg',
  effectiveDate: String(value?.effectiveDate || '').slice(0, 10),
  event: String(value?.event || '').trim().slice(0, 40),
  tags: [...new Set(
    (Array.isArray(value?.tags) ? value.tags : [])
      .map(tag => String(tag).trim().slice(0, 16))
      .filter(Boolean),
  )].slice(0, 8),
  notes: String(value?.notes || '').slice(0, 1000),
});

const normalizeBanlist = value => ({
  format: ['ocg', 'tcg', 'master-duel', 'custom'].includes(value?.format)
    ? value.format
    : 'ocg',
  effectiveDate: String(value?.effectiveDate || '').slice(0, 10),
  checkedAt: String(value?.checkedAt || ''),
  checkedCardIds: [...new Set(
    (Array.isArray(value?.checkedCardIds) ? value.checkedCardIds : [])
      .map(String),
  )],
  limits: Object.fromEntries(
    Object.entries(value?.limits || {}).map(([cardId, limit]) => [
      String(cardId),
      clampInteger(limit, 0, 3),
    ]),
  ),
  names: Object.fromEntries(
    Object.entries(value?.names || {}).map(([cardId, name]) => [
      String(cardId),
      String(name || ''),
    ]),
  ),
});

const normalizePreset = (preset, index) => ({
  id: String(preset?.id || `preset-${index + 1}`),
  name: String(preset?.name || `配置 ${index + 1}`).trim().slice(0, 32),
  createdAt: String(preset?.createdAt || ''),
  roles: normalizeAssignments(preset?.roles),
  customRoles: normalizeRoles(preset?.customRoles),
  goals: normalizeGoals(preset?.goals),
  activeGoalId: String(preset?.activeGoalId || ''),
});

export const createEmptyAnalysis = () => ({
  snapshots: [],
  activeSnapshotId: '',
  sidePlans: [],
  activeSidePlanId: '',
  inventory: normalizeInventory(),
  metadata: normalizeMetadata(),
  banlist: normalizeBanlist(),
  presets: [],
  activePresetId: '',
});

export const normalizeAnalysis = value => ({
  snapshots: (Array.isArray(value?.snapshots) ? value.snapshots : [])
    .slice(-20)
    .map(normalizeSnapshot),
  activeSnapshotId: String(value?.activeSnapshotId || ''),
  sidePlans: (Array.isArray(value?.sidePlans) ? value.sidePlans : [])
    .slice(-20)
    .map(normalizeSidePlan),
  activeSidePlanId: String(value?.activeSidePlanId || ''),
  inventory: normalizeInventory(value?.inventory),
  metadata: normalizeMetadata(value?.metadata),
  banlist: normalizeBanlist(value?.banlist),
  presets: (Array.isArray(value?.presets) ? value.presets : [])
    .slice(-12)
    .map(normalizePreset),
  activePresetId: String(value?.activePresetId || ''),
});

export const createDeckSnapshot = (value, name = '') => normalizeSnapshot({
  id: createId('snapshot'),
  name: name || `构筑快照 ${new Date().toLocaleDateString('zh-CN')}`,
  createdAt: new Date().toISOString(),
  deck: value?.deck,
  roles: value?.roles,
  customRoles: value?.customRoles,
  goals: value?.goals,
  activeGoalId: value?.activeGoalId,
}, 0);

export const createAnalysisPreset = (value, name = '') => normalizePreset({
  id: createId('preset'),
  name: name || `分析配置 ${new Date().toLocaleDateString('zh-CN')}`,
  createdAt: new Date().toISOString(),
  roles: value?.roles,
  customRoles: value?.customRoles,
  goals: value?.goals,
  activeGoalId: value?.activeGoalId,
}, 0);

const countCards = cardIds => {
  const counts = new Map();
  cardIds.forEach(cardId => {
    const id = String(cardId);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
};

const compareSection = (currentIds, snapshotIds) => {
  const current = countCards(currentIds);
  const snapshot = countCards(snapshotIds);
  const ids = new Set([...current.keys(), ...snapshot.keys()]);
  const added = [];
  const removed = [];
  ids.forEach(id => {
    const delta = (current.get(id) || 0) - (snapshot.get(id) || 0);
    if (delta > 0) added.push({ id, count: delta });
    if (delta < 0) removed.push({ id, count: Math.abs(delta) });
  });
  return { added, removed };
};

export const compareDecks = (currentDeck, snapshotDeck) => {
  const current = normalizeDeck(currentDeck);
  const snapshot = normalizeDeck(snapshotDeck);
  return Object.fromEntries(
    ['main', 'extra', 'side'].map(section => [
      section,
      compareSection(current[section], snapshot[section]),
    ]),
  );
};

const removeCopies = (cardIds, cardId, count) => {
  const next = [...cardIds];
  for (let index = 0; index < count; index += 1) {
    const position = next.indexOf(cardId);
    if (position < 0) break;
    next.splice(position, 1);
  }
  return next;
};

export const validateSidePlan = (deckValue, planValue) => {
  const deck = normalizeDeck(deckValue);
  const plan = normalizeSidePlan(planValue, 0);
  const errors = [];
  const requestedOut = new Map();
  const requestedIn = new Map();
  plan.swaps.forEach((swap, index) => {
    if (swap.outId === swap.inId) {
      errors.push(`第 ${index + 1} 组换备使用了相同卡片`);
    }
    const outKey = `${swap.outSection}:${swap.outId}`;
    requestedOut.set(outKey, (requestedOut.get(outKey) || 0) + swap.count);
    requestedIn.set(swap.inId, (requestedIn.get(swap.inId) || 0) + swap.count);
  });
  requestedOut.forEach((count, key) => {
    const [section, cardId] = key.split(':');
    if ((deck[section] || []).filter(id => id === cardId).length < count) {
      errors.push(`${cardId} 的换出数量超过${section === 'main' ? '主卡组' : '额外卡组'}持有数量`);
    }
  });
  requestedIn.forEach((count, cardId) => {
    if (deck.side.filter(id => id === cardId).length < count) {
      errors.push(`${cardId} 的换入数量超过副卡组持有数量`);
    }
  });
  if (!plan.swaps.length) errors.push('换备方案尚未添加交换项');
  return [...new Set(errors)];
};

export const applySidePlan = (deckValue, planValue) => {
  const deck = normalizeDeck(deckValue);
  const plan = normalizeSidePlan(planValue, 0);
  const errors = validateSidePlan(deck, plan);
  if (errors.length) return { deck, errors };
  plan.swaps.forEach(swap => {
    deck[swap.outSection] = removeCopies(
      deck[swap.outSection],
      swap.outId,
      swap.count,
    );
    deck.side = removeCopies(deck.side, swap.inId, swap.count);
    deck[swap.outSection].push(
      ...Array.from({ length: swap.count }, () => swap.inId),
    );
    deck.side.push(
      ...Array.from({ length: swap.count }, () => swap.outId),
    );
  });
  return { deck, errors: [] };
};

export const getMissingCards = (deckValue, inventoryValue) => {
  const deck = normalizeDeck(deckValue);
  const inventory = normalizeInventory(inventoryValue);
  if (!inventory.enabled) return [];
  const required = countCards([
    ...deck.main,
    ...deck.extra,
    ...deck.side,
  ]);
  return [...required.entries()].map(([id, count]) => ({
    id,
    required: count,
    owned: inventory.counts[id] || 0,
    missing: Math.max(0, count - (inventory.counts[id] || 0)),
  })).filter(item => item.missing > 0);
};

const countRoleInHand = (cardIds, assignments, roleId) => {
  return cardIds.reduce((total, cardId) =>
    total + Number(Boolean(assignments?.[String(cardId)]?.includes(roleId))), 0);
};

export const diagnoseGoalFailures = (
  history,
  assignments,
  goal,
  roleDefinitions,
) => {
  const conditions = Array.isArray(goal?.conditions) ? goal.conditions : [];
  const roleNames = new Map(
    (roleDefinitions || []).map(role => [role.id, role.label]),
  );
  const failures = new Map();
  let failedHands = 0;
  (Array.isArray(history) ? history : []).forEach(entry => {
    const cards = [
      ...(entry?.firstFive || []),
      ...(entry?.mode === 'second' && entry?.sixth ? [entry.sixth] : []),
    ];
    const states = conditions.map(condition => {
      const count = countRoleInHand(cards, assignments, condition.roleId);
      const matched = condition.comparator === 'atMost'
        ? count <= Number(condition.count)
        : count >= Number(condition.count);
      return { condition, count, matched };
    });
    const handMatches = goal?.mode === 'any'
      ? states.some(state => state.matched)
      : states.every(state => state.matched);
    if (handMatches) return;
    failedHands += 1;
    states.filter(state => !state.matched).forEach(({ condition }) => {
      const key = [
        condition.roleId,
        condition.comparator,
        condition.count,
      ].join(':');
      const roleName = roleNames.get(condition.roleId) || condition.roleId;
      const label = condition.comparator === 'atMost'
        ? `${roleName}超过 ${condition.count} 张`
        : `${roleName}不足 ${condition.count} 张`;
      failures.set(key, {
        id: key,
        label,
        count: (failures.get(key)?.count || 0) + 1,
      });
    });
  });
  return {
    failedHands,
    reasons: [...failures.values()]
      .sort((first, second) => second.count - first.count),
  };
};

export const cloneAnalysisValue = clone;
