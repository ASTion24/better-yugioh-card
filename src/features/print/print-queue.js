export const createPrintQueue = cardIds => {
  const queue = [];
  const entryMap = new Map();
  (cardIds || []).forEach(value => {
    const id = String(value);
    const existing = entryMap.get(id);
    if (existing) {
      existing.count += 1;
      return;
    }
    const entry = { id, count: 1 };
    entryMap.set(id, entry);
    queue.push(entry);
  });
  return queue;
};

export const normalizePrintQueue = entries => {
  return (entries || [])
    .map(entry => ({
      id: String(entry?.id || ''),
      count: Math.min(99, Math.max(0, Number(entry?.count) || 0)),
    }))
    .filter(entry => entry.id);
};

export const flattenPrintQueue = entries => {
  return normalizePrintQueue(entries).flatMap(entry =>
    Array.from({ length: entry.count }, () => entry.id));
};

export const movePrintQueueEntry = (entries, index, direction) => {
  const queue = normalizePrintQueue(entries);
  const target = index + direction;
  if (index < 0 || target < 0 || index >= queue.length ||
    target >= queue.length) return queue;
  [queue[index], queue[target]] = [queue[target], queue[index]];
  return queue;
};
