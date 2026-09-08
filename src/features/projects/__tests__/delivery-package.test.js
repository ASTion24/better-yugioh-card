import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { createDeliveryPackage } from '../delivery-package.js';

test('delivery package combines binary and text artifacts', async () => {
  const blob = await createDeliveryPackage({
    'deck.ydk': '#main\n89631139',
    'overview.png': new Blob([new Uint8Array([1, 2, 3])]),
  });
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ['deck.ydk', 'overview.png']);
  assert.equal(new TextDecoder().decode(files['deck.ydk']), '#main\n89631139');
  assert.deepEqual([...files['overview.png']], [1, 2, 3]);
});
