import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePrintableRenderMode } from '../generator.js';

test('print generation defaults to high-resolution rendering', () => {
  assert.equal(resolvePrintableRenderMode(), 'high');
  assert.equal(resolvePrintableRenderMode('high'), 'high');
});

test('quick card images cannot enter the print pipeline', () => {
  assert.throws(
    () => resolvePrintableRenderMode('quick'),
    /仅用于排版预览/,
  );
});
