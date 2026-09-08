import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchDeckSource,
  validateDeckSourceUrl,
} from '../deck-source-proxy.js';

test('deck source proxy only permits HTTPS YGOPRODeck pages', () => {
  assert.equal(
    validateDeckSourceUrl('https://ygoprodeck.com/deck/example').hostname,
    'ygoprodeck.com',
  );
  assert.throws(
    () => validateDeckSourceUrl('http://ygoprodeck.com/deck/example'),
    /Unsupported/,
  );
  assert.throws(
    () => validateDeckSourceUrl('https://example.com/deck/example'),
    /Unsupported/,
  );
});

test('deck source proxy returns bounded HTML responses', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('<main>deck</main>', {
    headers: { 'content-length': '17' },
  });
  try {
    assert.equal(
      await fetchDeckSource('https://www.ygoprodeck.com/deck/example'),
      '<main>deck</main>',
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('deck source proxy validates every redirect target', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(null, {
    status: 302,
    headers: { location: 'https://example.com/private' },
  });
  try {
    await assert.rejects(
      fetchDeckSource('https://ygoprodeck.com/deck/example'),
      /Unsupported/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
