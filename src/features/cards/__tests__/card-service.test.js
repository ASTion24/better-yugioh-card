import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSearchResult } from '../card-service.js';

test('unified card resolution preserves artwork identity and deck placement', async () => {
  const resolved = await resolveSearchResult({
    id: 13243124,
    artid: 13243125,
    sc_name: '超框测试卡',
    data: {
      type: 0x1 | 0x20 | 0x40,
      level: 8,
      race: 0x2000,
      attribute: 0x10,
      atk: 3000,
      def: 2500,
    },
    text: {
      types: '龙族/融合/效果',
      desc: '怪兽×2\n融合召唤。',
    },
  });

  assert.equal(resolved.id, '13243125');
  assert.equal(resolved.baseId, '13243124');
  assert.equal(resolved.alternateArtwork, true);
  assert.equal(resolved.renderMode, 'full-card');
  assert.equal(resolved.defaultSection, 'extra');
  assert.equal(resolved.name, '超框测试卡');
});

test('unified card resolution classifies prerelease records', async () => {
  const resolved = await resolveSearchResult({
    id: 101307001,
    prerelease: true,
    cn_name: '先行测试卡',
    data: {
      type: 0x1 | 0x20,
      level: 4,
      race: 0x1,
      attribute: 0x1,
      atk: 1800,
      def: 1000,
    },
    text: { desc: '测试效果。' },
  });

  assert.equal(resolved.prerelease, true);
  assert.equal(resolved.source, 'prerelease');
  assert.equal(resolved.renderMode, 'redraw');
  assert.equal(resolved.defaultSection, 'main');
});
