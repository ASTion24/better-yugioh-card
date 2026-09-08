import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchFingerprint,
  parseFingerprintIndex,
} from '../fingerprint-index.js';

const writeHash = (view, offset, value) => {
  const hash = BigInt(`0x${value}`);
  view.setUint32(offset, Number(hash & 0xffffffffn), true);
  view.setUint32(offset + 4, Number(hash >> 32n & 0xffffffffn), true);
};

const createIndex = (records, version = 1) => {
  const recordSize = version === 2 ? 56 : 24;
  const buffer = new ArrayBuffer(12 + records.length * recordSize);
  const bytes = new Uint8Array(buffer);
  bytes.set([89, 71, 70, 80], 0);
  const view = new DataView(buffer);
  view.setUint16(4, version, true);
  view.setUint16(6, recordSize, true);
  view.setUint32(8, records.length, true);
  records.forEach((record, index) => {
    const offset = 12 + index * recordSize;
    view.setUint32(offset, record.id, true);
    writeHash(view, offset + 4, record.art);
    writeHash(view, offset + 12, record.full);
    record.color.forEach((value, colorIndex) => {
      view.setUint8(offset + 20 + colorIndex, value);
    });
    (record.tiles || []).forEach((hash, tileIndex) => {
      writeHash(view, offset + 24 + tileIndex * 8, hash);
    });
  });
  return buffer;
};

test('fingerprint index ranks exact visual matches first', () => {
  const index = parseFingerprintIndex(createIndex([
    {
      id: 89631139,
      art: '0123456789abcdef',
      full: 'fedcba9876543210',
      color: [80, 110, 140],
    },
    {
      id: 46986414,
      art: 'ffffffffffffffff',
      full: 'ffffffffffffffff',
      color: [180, 40, 70],
    },
  ]));
  const matches = matchFingerprint(index, {
    art: '0123456789abcdef',
    full: 'fedcba9876543210',
    color: [80, 110, 140],
  });
  assert.equal(matches[0].id, '89631139');
  assert.equal(matches[0].artDistance, 0);
  assert.equal(matches[0].confidence, 96);
});

test('fingerprint index rejects malformed and truncated data', () => {
  assert.throws(
    () => parseFingerprintIndex(new Uint8Array([1, 2, 3])),
    /无效/,
  );
  const buffer = createIndex([{
    id: 89631139,
    art: '0',
    full: '0',
    color: [0, 0, 0],
  }]);
  assert.throws(
    () => parseFingerprintIndex(buffer.slice(0, buffer.byteLength - 1)),
    /不完整/,
  );
});

test('local tile hashes disambiguate watermarked artwork', () => {
  const repeatedHash = 'aaaaaaaaaaaaaaaa';
  const correctTiles = [
    '0123456789abcdef',
    '1111222233334444',
    '5555666677778888',
    '9999aaaabbbbcccc',
  ];
  const index = parseFingerprintIndex(createIndex([
    {
      id: 89631139,
      art: repeatedHash,
      full: repeatedHash,
      color: [80, 110, 140],
      tiles: correctTiles,
    },
    {
      id: 46986414,
      art: repeatedHash,
      full: repeatedHash,
      color: [80, 110, 140],
      tiles: [
        'ffffffffffffffff',
        'eeeeeeeeeeeeeeee',
        'dddddddddddddddd',
        'cccccccccccccccc',
      ],
    },
  ], 2));
  const matches = matchFingerprint(index, {
    art: repeatedHash,
    full: repeatedHash,
    color: [80, 110, 140],
    tiles: [
      correctTiles[0],
      correctTiles[1],
      correctTiles[2],
      'ffffffffffffffff',
    ],
  });
  assert.equal(matches[0].id, '89631139');
  assert.ok(matches[0].tileDistance < matches[1].tileDistance);
});
