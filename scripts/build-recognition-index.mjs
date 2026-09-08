import fs from 'node:fs/promises';
import path from 'node:path';
import { Canvas, loadImage } from 'skia-canvas';

const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes';
const OUTPUT_PATH = path.resolve(
  'src/assets/recognition/card-fingerprints.bin',
);
const CONCURRENCY = 24;
const RECORD_SIZE = 56;
const HEADER_SIZE = 12;

const grayscale = (red, green, blue) => {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
};

const createHash = (image, source) => {
  const canvas = new Canvas(9, 8);
  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const data = context.getImageData(0, 0, 9, 8).data;
  let hash = 0n;
  let offset = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const first = (y * 9 + x) * 4;
      const second = first + 4;
      if (grayscale(
        data[first],
        data[first + 1],
        data[first + 2],
      ) > grayscale(
        data[second],
        data[second + 1],
        data[second + 2],
      )) {
        hash |= 1n << offset;
      }
      offset += 1n;
    }
  }
  return hash;
};

const getArtworkRegion = image => ({
  x: image.width * 0.11,
  y: image.height * 0.17,
  width: image.width * 0.78,
  height: image.height * 0.54,
});

const getTileRegions = region => {
  const width = region.width * 0.54;
  const height = region.height * 0.54;
  return [
    { x: region.x, y: region.y, width, height },
    {
      x: region.x + region.width - width,
      y: region.y,
      width,
      height,
    },
    {
      x: region.x,
      y: region.y + region.height - height,
      width,
      height,
    },
    {
      x: region.x + region.width - width,
      y: region.y + region.height - height,
      width,
      height,
    },
  ];
};

const createAverageColor = image => {
  const canvas = new Canvas(8, 8);
  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    image.width * 0.11,
    image.height * 0.17,
    image.width * 0.78,
    image.height * 0.54,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const data = context.getImageData(0, 0, 8, 8).data;
  const total = [0, 0, 0];
  for (let index = 0; index < data.length; index += 4) {
    total[0] += data[index];
    total[1] += data[index + 1];
    total[2] += data[index + 2];
  }
  return total.map(value => Math.round(value / 64));
};

const fetchBytes = async (url, attempts = 3) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise(resolve =>
          setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

const createRecord = async item => {
  const image = await loadImage(await fetchBytes(item.url));
  const artworkRegion = getArtworkRegion(image);
  const fullRegion = {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  };
  return {
    id: item.id,
    artworkHash: createHash(image, artworkRegion),
    fullHash: createHash(image, fullRegion),
    color: createAverageColor(image),
    tileHashes: getTileRegions(artworkRegion)
      .map(region => createHash(image, region)),
  };
};

const runPool = async (items, worker, concurrency) => {
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        console.warn(
          `skip ${items[index].id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
      completed += 1;
      if (completed % 500 === 0 || completed === items.length) {
        console.log(`${completed} / ${items.length}`);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      run,
    ),
  );
  return results.filter(Boolean);
};

const writeHash = (view, offset, value) => {
  view.setUint32(offset, Number(value & 0xffffffffn), true);
  view.setUint32(offset + 4, Number(value >> 32n & 0xffffffffn), true);
};

const serializeIndex = records => {
  const buffer = new ArrayBuffer(HEADER_SIZE + records.length * RECORD_SIZE);
  const bytes = new Uint8Array(buffer);
  bytes.set([89, 71, 70, 80], 0);
  const view = new DataView(buffer);
  view.setUint16(4, 2, true);
  view.setUint16(6, RECORD_SIZE, true);
  view.setUint32(8, records.length, true);
  records.forEach((record, index) => {
    const offset = HEADER_SIZE + index * RECORD_SIZE;
    view.setUint32(offset, record.id, true);
    writeHash(view, offset + 4, record.artworkHash);
    writeHash(view, offset + 12, record.fullHash);
    view.setUint8(offset + 20, record.color[0]);
    view.setUint8(offset + 21, record.color[1]);
    view.setUint8(offset + 22, record.color[2]);
    view.setUint8(offset + 23, 0);
    record.tileHashes.forEach((hash, tileIndex) => {
      writeHash(view, offset + 24 + tileIndex * 8, hash);
    });
  });
  return new Uint8Array(buffer);
};

const response = await fetch(API_URL);
if (!response.ok) {
  throw new Error(`Card catalog request failed (${response.status})`);
}
const payload = await response.json();
const uniqueImages = new Map();
(payload.data || []).forEach(card => {
  (card.card_images || []).forEach(image => {
    const id = Number(image.id);
    if (Number.isInteger(id) && id > 0 && !uniqueImages.has(id)) {
      uniqueImages.set(id, {
        id,
        url: image.image_url_small,
      });
    }
  });
});
const requestedLimit = Math.trunc(Number(
  process.argv.find(value => value.startsWith('--limit='))?.split('=')[1],
)) || 0;
const images = [...uniqueImages.values()]
  .sort((first, second) => first.id - second.id)
  .slice(0, requestedLimit || undefined);
console.log(`building ${images.length} card fingerprints`);
const records = await runPool(images, createRecord, CONCURRENCY);
await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(OUTPUT_PATH, serializeIndex(records));
console.log(`wrote ${records.length} records to ${OUTPUT_PATH}`);
