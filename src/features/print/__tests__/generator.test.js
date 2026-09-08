import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRenderHighResolution } from '../generator.js';

test('prerelease cards always use high-resolution rendering', () => {
  assert.equal(shouldRenderHighResolution('101307001', 'quick'), true);
  assert.equal(shouldRenderHighResolution('101307001', 'high'), true);
  assert.equal(shouldRenderHighResolution('89631139', 'quick'), false);
  assert.equal(shouldRenderHighResolution('89631139', 'high'), true);
});
