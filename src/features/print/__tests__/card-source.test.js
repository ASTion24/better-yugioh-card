import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCardArtworkId,
  getCardDisplayName,
  getCardPreviewUrl,
  getPrereleaseArchiveVersion,
  getRawCardImageUrl,
  isAlternateArtworkCard,
  isPrereleaseCardId,
  PRERELEASE_PACK_URL,
  searchCardDatabase,
} from '../card-source.js';

test('card display names prefer simplified Chinese and retain database fallbacks', () => {
  assert.equal(getCardDisplayName({
    sc_name: '邪恶之箱',
    cn_name: '邪魔箱',
    jp_name: 'エビル・ボックス',
  }), '邪恶之箱');
  assert.equal(getCardDisplayName({
    cn_name: '邪魔箱',
    jp_name: 'エビル・ボックス',
  }), '邪魔箱');
  assert.equal(getCardDisplayName({ jp_name: 'エビル・ボックス' }), 'エビル・ボックス');
  assert.equal(getCardDisplayName({ id: 8915275 }), '');
});

test('prerelease card IDs use the MyCard full-image source', () => {
  assert.equal(isPrereleaseCardId('100267001'), true);
  assert.equal(isPrereleaseCardId('101307001'), true);
  assert.equal(isPrereleaseCardId('89631139'), false);
  assert.equal(
    getRawCardImageUrl('100267001', 'sc'),
    'https://cdn.233.momobako.com/ygopro/pics/100267001.jpg',
  );
  assert.equal(
    getRawCardImageUrl('89631139', 'sc'),
    'https://cdn.233.momobako.com/ygoimg/sc/89631139.webp',
  );
});

test('print previews use the full simplified-Chinese card image', () => {
  assert.equal(
    getCardPreviewUrl('89631139'),
    'https://cdn.233.momobako.com/ygoimg/sc/89631139.webp',
  );
  assert.doesNotMatch(getCardPreviewUrl('89631139'), /!half$/);
});

test('prerelease archive uses the rolling latest URL and version fallbacks', () => {
  assert.equal(
    PRERELEASE_PACK_URL,
    'https://cdntx.moecube.com/ygopro-super-pre/archive/ygopro-super-pre.ypk',
  );
  assert.equal(
    getPrereleaseArchiveVersion({
      url: 'https://cdntx.moecube.com/ygopro-super-pre/archive/ygopro-super-pre-28.1.ypk',
      headers: new Headers({ etag: '"version-28.1"' }),
    }),
    '"version-28.1"',
  );
  assert.equal(
    getPrereleaseArchiveVersion({
      url: 'https://cdntx.moecube.com/ygopro-super-pre/archive/ygopro-super-pre-28.1.ypk',
      headers: new Headers(),
    }),
    'https://cdntx.moecube.com/ygopro-super-pre/archive/ygopro-super-pre-28.1.ypk',
  );
});

test('alternate artwork records preserve their requested artwork ID', () => {
  const searchRecord = {
    id: 13243124,
    artid: 13243125,
  };
  const cardRecord = {
    id: 13243124,
    altart: 13243125,
  };

  assert.equal(getCardArtworkId(searchRecord), '13243125');
  assert.equal(getCardArtworkId(cardRecord), '13243125');
  assert.equal(isAlternateArtworkCard(cardRecord, '13243125'), true);
  assert.equal(isAlternateArtworkCard(cardRecord, '13243124'), false);
  assert.equal(isAlternateArtworkCard({ id: 13243124 }, '13243124'), false);
});

test('searchCardDatabase queries YGOCDB by card ID and caches the result', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        result: [{ id: 89631139, sc_name: '青眼白龙' }],
      }),
    };
  };

  try {
    const first = await searchCardDatabase('89631139');
    const second = await searchCardDatabase('89631139');
    assert.equal(first[0].id, 89631139);
    assert.deepEqual(second, first);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /search=89631139/);
  } finally {
    global.fetch = originalFetch;
  }
});
