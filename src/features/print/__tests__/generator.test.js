import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PRINT_RENDER_MODE,
  PRINT_RENDER_MODES,
  resolvePrintableRenderMode,
} from '../generator.js';

test('print generation defaults to medium simplified-card images', () => {
  assert.equal(DEFAULT_PRINT_RENDER_MODE, 'medium');
  assert.equal(resolvePrintableRenderMode(), 'medium');
  assert.equal(resolvePrintableRenderMode(PRINT_RENDER_MODES.MEDIUM), 'medium');
  assert.equal(resolvePrintableRenderMode(PRINT_RENDER_MODES.HIGH), 'high');
});

test('low-resolution preview thumbnails cannot enter the print pipeline', () => {
  assert.throws(
    () => resolvePrintableRenderMode('quick'),
    /低清缩略图不能生成打印文件/,
  );
});
