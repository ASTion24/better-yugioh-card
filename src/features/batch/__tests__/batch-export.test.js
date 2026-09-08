import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';
import {
  createBatchDeliveryZip,
  createBatchZip,
  dataUrlToBlob,
  sanitizeFilename,
  serializeBatchCsv,
  serializeBatchJson,
} from '../batch-export.js';
import { parseBatchCards } from '../batch-parser.js';

test('batch filenames remove reserved path characters', () => {
  assert.equal(sanitizeFilename('  0001:测试/卡  '), '0001-测试-卡');
  assert.equal(sanitizeFilename(''), '未命名卡片');
});

test('data URL conversion retains MIME type and bytes', async () => {
  const blob = dataUrlToBlob('data:text/plain;base64,SGVsbG8=');
  assert.equal(blob.type, 'text/plain');
  assert.equal(await blob.text(), 'Hello');
});

test('batch ZIP exports stable, unique PNG filenames', async () => {
  const blob = await createBatchZip([
    {
      password: '00000001',
      name: '测试卡',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
    {
      password: '00000001',
      name: '测试卡',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
  ]);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files), [
    '001-00000001-测试卡.png',
    '002-00000001-测试卡-2.png',
  ]);
});

test('batch delivery ZIP includes images, manifest, and editable data', async () => {
  const blob = await createBatchDeliveryZip([{
    batchId: 'local-only',
    password: '00000001',
    name: '测试卡',
    type: 'monster',
    cardType: 'effect',
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    quality: {
      status: 'attention',
      issues: [{ message: '效果文本为空' }],
    },
  }]);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files), [
    'cards/001-00000001-测试卡.png',
    'manifest.csv',
    'batch-data.json',
  ]);
  assert.match(
    new TextDecoder().decode(files['manifest.csv']),
    /attention,效果文本为空/,
  );
  const source = JSON.parse(
    new TextDecoder().decode(files['batch-data.json']),
  );
  assert.equal(source.cards[0].batchId, undefined);
  assert.equal(source.cards[0].dataUrl, undefined);
});

test('batch structured exports preserve editable fields', () => {
  const cards = [{
    batchId: 'local-only',
    name: '测试,卡',
    password: '00000001',
    description: '第一行\n第二行',
    arrowList: [1, 3],
  }];
  const csv = serializeBatchCsv(cards);
  assert.match(csv, /"测试,卡"/);
  assert.match(csv, /"第一行\n第二行"/);
  assert.doesNotMatch(csv, /local-only/);

  const json = JSON.parse(serializeBatchJson(cards));
  assert.equal(json.cards[0].name, '测试,卡');
  assert.deepEqual(json.cards[0].arrowList, [1, 3]);
  assert.equal(json.cards[0].batchId, undefined);

  const [roundTripped] = parseBatchCards(serializeBatchCsv([{
    name: '完整样式',
    password: '1',
    arrowList: [1, 3],
    gradient: true,
    descriptionZoom: 0.9,
  }]));
  assert.deepEqual(roundTripped.arrowList, [1, 3]);
  assert.equal(roundTripped.gradient, true);
  assert.equal(roundTripped.descriptionZoom, 0.9);
});
