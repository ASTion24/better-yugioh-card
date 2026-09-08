import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchBanlistForCards,
  inspectBanlist,
  parseBanlistOverrides,
} from '../banlist.js';

test('manual banlist overrides parse compact card limits', () => {
  const result = parseBanlistOverrides(`
    # card limits
    14558127=2
    23434538 1
    invalid
  `);
  assert.deepEqual(result.limits, {
    14558127: 2,
    23434538: 1,
  });
  assert.deepEqual(result.errors, ['第 5 行格式无效']);
});

test('banlist lookup requests only current official card IDs', async () => {
  const requests = [];
  const result = await fetchBanlistForCards(
    ['014558127', '23434538', 'custom:one'],
    'ocg',
    {
      fetch: async url => {
        requests.push(String(url));
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 14558127,
                name: 'Ash Blossom',
                banlist_info: { ban_ocg: 'Semi-Limited' },
              },
              {
                id: 23434538,
                name: 'Maxx C',
                banlist_info: { ban_ocg: 'Limited' },
              },
            ],
          }),
        };
      },
    },
  );
  assert.equal(requests.length, 1);
  assert.match(requests[0], /14558127%2C23434538/);
  assert.deepEqual(result.limits, {
    14558127: 2,
    23434538: 1,
  });
});

test('banlist inspection counts main, extra and side together', () => {
  const result = inspectBanlist({
    main: ['1', '1'],
    extra: ['2'],
    side: ['1', 'custom:test'],
  }, {
    checkedCardIds: ['1', '2'],
    limits: { 1: 2 },
    names: { 1: '受限卡' },
  });
  assert.deepEqual(result.violations, [{
    id: '1',
    name: '受限卡',
    count: 3,
    limit: 2,
  }]);
  assert.deepEqual(result.unknownIds, ['custom:test']);
});
