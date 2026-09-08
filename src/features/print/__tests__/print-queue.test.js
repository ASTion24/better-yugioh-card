import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPrintQueue,
  flattenPrintQueue,
  movePrintQueueEntry,
  normalizePrintQueue,
} from '../print-queue.js';

test('print queue groups deck copies while preserving first-seen order', () => {
  assert.deepEqual(createPrintQueue(['1', '1', '2', '1', '3']), [
    { id: '1', count: 3 },
    { id: '2', count: 1 },
    { id: '3', count: 1 },
  ]);
});

test('print queue counts are bounded and flatten back into printable IDs', () => {
  const queue = normalizePrintQueue([
    { id: '1', count: 2 },
    { id: '2', count: -1 },
    { id: '3', count: 120 },
  ]);
  assert.equal(queue[1].count, 0);
  assert.equal(queue[2].count, 99);
  assert.deepEqual(flattenPrintQueue(queue).slice(0, 3), ['1', '1', '3']);
  assert.equal(flattenPrintQueue(queue).length, 101);
});

test('print queue entries can be reordered without changing their counts', () => {
  const queue = [
    { id: '1', count: 2 },
    { id: '2', count: 1 },
  ];
  assert.deepEqual(movePrintQueueEntry(queue, 1, -1), [
    { id: '2', count: 1 },
    { id: '1', count: 2 },
  ]);
});
