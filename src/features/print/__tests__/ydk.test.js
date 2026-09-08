import assert from 'node:assert/strict';
import test from 'node:test';
import {
  flattenDeck,
  mergeDecks,
  parseDeckInput,
  parseOurygoDeckUrl,
  parseYdk,
  parseYdke,
  serializeYdk,
  serializeYdke,
  summarizeDeck,
} from '../ydk.js';

const OURYGO_V1_URL = 'http://deck.ourygo.top' +
  '?name=%E9%9B%B7%E7%81%AB%E5%8D%A1%E9%80%9A01' +
  '&ygotype=deck&v=1' +
  '&d=GPlEQEpbXjC0kQd3WqIvHNYnIitq21RNQOTHXQStRNQYOaqC5rthvEdfuK91N' +
  'LLKlTZyJ_WLFjgMY3tZaJT671dQaDroW-Mt5pXcN6WA4mUgiUFrQusqKaVGUJeqL' +
  'OISG3vjRpCbJxWhxL8iXrERTZRHqhSskEOU8esj11CVd1IWhqkJ9o3HRSsmw4V95' +
  '_u5nxrXp0jdvRjsThIpufc_KxI0eI0DSlCFBXBiCip4BPs';

const encodeYdkeSection = ids => {
  const buffer = Buffer.alloc(ids.length * 4);
  ids.forEach((id, index) => buffer.writeUInt32LE(id, index * 4));
  return buffer.toString('base64');
};

test('parseYdk handles BOM, CRLF, comments, duplicate cards and leading zeros', () => {
  const result = parseYdk('\uFEFF#created by test\r\n#main\r\n00123456\r\n00123456\r\n#extra\r\n89631139\r\n!side\r\n46986414\r\n');
  assert.deepEqual(result.main, ['00123456', '00123456']);
  assert.deepEqual(result.extra, ['89631139']);
  assert.deepEqual(result.side, ['46986414']);
  assert.deepEqual(result.warnings, []);
});

test('parseYdk reports malformed card rows without discarding valid rows', () => {
  const result = parseYdk('#main\n89631139\nnot-a-card\n#side\n46986414');
  assert.deepEqual(result.main, ['89631139']);
  assert.deepEqual(result.side, ['46986414']);
  assert.equal(result.warnings.length, 1);
});

test('parseYdke decodes all three little-endian card sections', () => {
  const value = `ydke://${encodeYdkeSection([89631139, 89631139])}!${encodeYdkeSection([23995346])}!${encodeYdkeSection([46986414])}!`;
  const result = parseYdke(value);
  assert.deepEqual(result.main, ['89631139', '89631139']);
  assert.deepEqual(result.extra, ['23995346']);
  assert.deepEqual(result.side, ['46986414']);
});

test('parseDeckInput routes YDKe and rejects empty values', () => {
  const value = `ydke://${encodeYdkeSection([89631139])}!!!`;
  assert.deepEqual(parseDeckInput(value).main, ['89631139']);
  assert.throws(() => parseDeckInput(''), /请输入/);
});

test('serializeYdk preserves sections, order and duplicate cards', () => {
  const deck = {
    main: ['89631139', '89631139'],
    extra: ['23995346'],
    side: ['46986414'],
  };
  const serialized = serializeYdk(deck, 'test');
  assert.equal(
    serialized,
    '#created by test\n#main\n89631139\n89631139\n#extra\n23995346\n!side\n46986414\n',
  );
  assert.deepEqual(parseYdk(serialized), {
    ...deck,
    warnings: [],
  });
});

test('serializeYdke round-trips all deck sections', () => {
  const deck = {
    main: ['89631139', '89631139', '13243125'],
    extra: ['23995346'],
    side: ['46986414'],
  };
  assert.deepEqual(parseYdke(serializeYdke(deck)), {
    ...deck,
    warnings: [],
  });
});

test('YDK and YDKe exports omit project-only custom cards', () => {
  const deck = {
    main: ['89631139', 'custom:original-1'],
    extra: ['custom:original-2', '23995346'],
    side: [],
  };
  const ydk = serializeYdk(deck);
  assert.equal(ydk.includes('custom:'), false);
  assert.deepEqual(parseYdk(ydk).main, ['89631139']);
  assert.deepEqual(parseYdk(ydk).extra, ['23995346']);
  assert.deepEqual(parseYdke(serializeYdke(deck)).main, ['89631139']);
  assert.deepEqual(parseYdke(serializeYdke(deck)).extra, ['23995346']);
});

test('parseOurygoDeckUrl decodes v1 Base64URL deck data and card counts', () => {
  const result = parseOurygoDeckUrl(OURYGO_V1_URL);
  assert.equal(result.name, '雷火卡通01');
  assert.equal(result.source, 'ourygo');
  assert.deepEqual(summarizeDeck(result), {
    main: 42,
    extra: 15,
    side: 15,
    total: 72,
    unique: 48,
  });
  assert.deepEqual(result.main.slice(0, 9), [
    '8915275',
    '91800274',
    '8633261',
    '35844557',
    '72238166',
    '45536531',
    '45536531',
    '45536531',
    '34022970',
  ]);
  assert.deepEqual(result.extra, [
    '13243125',
    '11765832',
    '96334243',
    '17412721',
    '54757758',
    '9940036',
    '40673853',
    '34909328',
    '7511613',
    '76504386',
    '45852939',
    '6983839',
    '85692042',
    '46772449',
    '66011101',
  ]);
  assert.deepEqual(result.side.slice(-5), [
    '15800838',
    '43262273',
    '43262273',
    '58921041',
    '41420027',
  ]);
});

test('parseOurygoDeckUrl supports v0 section parameters', () => {
  const result = parseDeckInput(
    'https://deck.ourygo.top/ydk/show.html?ygotype=deck&v=0' +
    '&main=89631139*2_46986414&extra=23995346&side=12580477*2',
  );
  assert.deepEqual(result.main, ['89631139', '89631139', '46986414']);
  assert.deepEqual(result.extra, ['23995346']);
  assert.deepEqual(result.side, ['12580477', '12580477']);
});

test('parseOurygoDeckUrl rejects unsupported or incomplete links', () => {
  assert.throws(
    () => parseOurygoDeckUrl('https://example.com/?v=1&d=AAAA'),
    /仅支持/,
  );
  assert.throws(
    () => parseOurygoDeckUrl('https://deck.ourygo.top/?v=2&d=AAAA'),
    /暂不支持/,
  );
  assert.throws(
    () => parseOurygoDeckUrl('https://deck.ourygo.top/?v=1&d=AQA'),
    /不完整/,
  );
});

test('flattenDeck and summarizeDeck preserve print order', () => {
  const deck = {
    main: ['1', '1'],
    extra: ['2'],
    side: ['3'],
  };
  assert.deepEqual(flattenDeck(deck, ['main', 'side']), ['1', '1', '3']);
  assert.deepEqual(summarizeDeck(deck), {
    main: 2,
    extra: 1,
    side: 1,
    total: 4,
    unique: 3,
  });
});

test('mergeDecks appends every section and preserves warnings', () => {
  assert.deepEqual(
    mergeDecks(
      {
        main: ['1'],
        extra: ['2'],
        side: [],
        warnings: ['原警告'],
      },
      {
        main: ['3', '3'],
        extra: [],
        side: ['4'],
        warnings: ['新警告'],
      },
    ),
    {
      main: ['1', '3', '3'],
      extra: ['2'],
      side: ['4'],
      warnings: ['原警告', '新警告'],
    },
  );
});
