import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseYgoprodeckPage,
  resolveDeckInput,
} from '../remote-deck.js';

const YGOPRODECK_HTML = `
  <script>var deckname = "示例卡组";</script>
  <div id="main_deck">
    <span data-card="89631139"></span>
    <span data-card="89631139"></span>
  </div>
  <div id="extra_deck"><span data-card="23995346"></span></div>
  <div id="side_deck"><span data-card="46986414"></span></div>
`;

test('YGOPRODeck page parser preserves sections, duplicates and title', () => {
  const deck = parseYgoprodeckPage(YGOPRODECK_HTML, 'https://ygoprodeck.com/deck/test');
  assert.equal(deck.name, '示例卡组');
  assert.deepEqual(deck.main, ['89631139', '89631139']);
  assert.deepEqual(deck.extra, ['23995346']);
  assert.deepEqual(deck.side, ['46986414']);
  assert.equal(deck.source, 'ygoprodeck');
});

test('YGOPRODeck page parser falls back to embedded JavaScript arrays', () => {
  const deck = parseYgoprodeckPage(`
    <script>
      var deckname = '脚本卡组';
      var maindeckjs = '["89631139","89631139"]';
      var extradeckjs = '["23995346"]';
      var sidedeckjs = '["46986414"]';
    </script>
  `);
  assert.equal(deck.name, '脚本卡组');
  assert.deepEqual(deck.main, ['89631139', '89631139']);
  assert.deepEqual(deck.extra, ['23995346']);
  assert.deepEqual(deck.side, ['46986414']);
});

test('remote deck input loads direct YDK URLs', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(
    '#main\n89631139\n#extra\n23995346\n!side\n46986414',
  );
  try {
    const deck = await resolveDeckInput(
      'https://raw.githubusercontent.com/example/decks/main/test.ydk',
    );
    assert.equal(deck.name, 'test');
    assert.deepEqual(deck.main, ['89631139']);
    assert.deepEqual(deck.extra, ['23995346']);
    assert.deepEqual(deck.side, ['46986414']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('YGOPRODeck import falls back to the configured proxy endpoint', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    if (calls.length === 1) throw new TypeError('CORS blocked');
    return new Response(YGOPRODECK_HTML);
  };
  try {
    const deck = await resolveDeckInput('https://ygoprodeck.com/deck/test');
    assert.equal(deck.name, '示例卡组');
    assert.match(calls[1], /^\/api\/deck-source\?url=/);
  } finally {
    global.fetch = originalFetch;
  }
});
