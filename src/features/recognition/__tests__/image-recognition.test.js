import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeckFromRecognition,
  createGridRegions,
  extractCardIdCandidates,
  getRecognitionStatus,
  groupRecognitionRegions,
  hammingDistance,
  isRecognitionConfirmed,
  mergeResolvedRecognitionItems,
  summarizeRecognition,
} from '../image-recognition.js';

test('grid recognition regions respect card ratio, margins and gaps', () => {
  const regions = createGridRegions(1000, 800, {
    columns: 4,
    rows: 2,
    padding: 2,
    gap: 1,
  });
  assert.equal(regions.length, 8);
  assert.ok(Math.abs(regions[0].width / regions[0].height - 59 / 86) < 0.001);
  assert.ok(regions[0].x >= 16);
  assert.ok(regions[1].x > regions[0].x + regions[0].width);
  assert.ok(regions[4].y > regions[0].y + regions[0].height);
});

test('OCR card IDs recover common character substitutions', () => {
  assert.deepEqual(
    extractCardIdCandidates('code: 8O63I139'),
    ['80631139'],
  );
  assert.deepEqual(
    extractCardIdCandidates('8963 1139\n46986414'),
    ['89631139', '46986414'],
  );
});

test('difference hash distance counts changed bits', () => {
  assert.equal(hammingDistance('0000000000000000', '000000000000000f'), 4);
  assert.equal(hammingDistance('ffffffffffffffff', 'ffffffffffffffff'), 0);
  assert.equal(hammingDistance('', '1'), Number.POSITIVE_INFINITY);
});

test('visual fingerprints group duplicate regions without losing count', () => {
  const groups = groupRecognitionRegions([
    {
      fingerprint: '0000000000000000',
      crop: 'first',
      region: { id: 'a' },
    },
    {
      fingerprint: '0000000000000000',
      crop: 'second',
      region: { id: 'b' },
    },
    {
      fingerprint: 'ffffffffffffffff',
      crop: 'third',
      region: { id: 'c' },
    },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].regions.map(region => region.id), ['a', 'b']);
});

test('visual duplicates remain separate across deck sections', () => {
  const groups = groupRecognitionRegions([
    {
      fingerprint: '0123456789abcdef',
      crop: 'main',
      region: { id: 'main-card', sectionHint: 'main' },
    },
    {
      fingerprint: '0123456789abcdef',
      crop: 'side',
      region: { id: 'side-card', sectionHint: 'side' },
    },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].section, 'main');
  assert.equal(groups[1].section, 'side');
});

test('recognized identities merge duplicate visual groups in one section', () => {
  const items = mergeResolvedRecognitionItems([
    {
      cardId: '20455229',
      count: 1,
      section: 'main',
      confidence: 90,
      regions: [{ id: 'first' }],
      crops: ['first'],
    },
    {
      cardId: '20455229',
      count: 2,
      section: 'main',
      confidence: 48,
      regions: [{ id: 'second' }],
      crops: ['second'],
    },
    {
      cardId: '20455229',
      count: 1,
      section: 'side',
      confidence: 90,
      regions: [{ id: 'side' }],
      crops: ['side'],
    },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].count, 3);
  assert.equal(items[0].regions.length, 2);
  assert.equal(items[0].section, 'main');
  assert.equal(items[1].section, 'side');
});

test('confirmed recognition groups become sectioned deck entries', () => {
  const items = [
    {
      cardId: '089631139',
      count: 3,
      section: 'main',
      confidence: 96,
      source: 'ocr',
    },
    {
      cardId: '23995346',
      count: 2,
      section: 'extra',
      source: 'manual',
    },
    {
      cardId: '',
      count: 4,
      section: 'side',
      error: '未识别',
    },
    {
      cardId: '12580477',
      count: 1,
      section: 'side',
      excluded: true,
    },
  ];
  assert.deepEqual(buildDeckFromRecognition(items), {
    main: ['89631139', '89631139', '89631139'],
    extra: ['23995346', '23995346'],
    side: [],
    warnings: [],
  });
  assert.deepEqual(summarizeRecognition(items), {
    detected: 9,
    resolved: 5,
    unresolved: 4,
    unresolvedGroups: 1,
  });
  assert.equal(getRecognitionStatus(items[0]), 'confident');
  assert.equal(getRecognitionStatus(items[1]), 'confirmed');
  assert.equal(getRecognitionStatus(items[2]), 'error');
  assert.equal(getRecognitionStatus(items[3]), 'excluded');
  assert.equal(isRecognitionConfirmed({
    cardId: '89631139',
    confidence: 62,
    source: 'ocr',
  }), false);
  assert.equal(isRecognitionConfirmed({
    cardId: '89631139',
    confidence: 62,
    source: 'ocr',
    confirmed: true,
  }), true);
});

test('recognized deck export prefers the canonical YDK card ID', () => {
  assert.deepEqual(buildDeckFromRecognition([
    {
      cardId: '123456789',
      ydkId: '89631139',
      count: 2,
      section: 'main',
      source: 'manual',
    },
  ]), {
    main: ['89631139', '89631139'],
    extra: [],
    side: [],
    warnings: [],
  });
});
