import {
  extractCardIdCandidates,
  groupRecognitionRegions,
} from './image-recognition.js';
import { parseFingerprintIndex } from './fingerprint-index.js';

const CARD_ASPECT_RATIO = 59 / 86;
const MAX_SOURCE_SIDE = 2400;
const MAX_DETECTION_SIDE = 720;
const FINGERPRINT_INDEX_URL = new URL(
  '../../assets/recognition/card-fingerprints.bin',
  import.meta.url,
);
let fingerprintIndexPromise = null;

const createCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const loadHtmlImage = file => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('图片解码失败'));
  };
  image.src = url;
});

export const loadRecognitionImage = async file => {
  if (!(file instanceof Blob) || !file.type.startsWith('image/')) {
    throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  }
  let image;
  try {
    image = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
  } catch {
    image = await loadHtmlImage(file);
  }
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    image.close?.();
    throw new Error('无法读取图片尺寸');
  }
  const scale = Math.min(
    1,
    MAX_SOURCE_SIDE / Math.max(sourceWidth, sourceHeight),
  );
  const canvas = createCanvas(
    sourceWidth * scale,
    sourceHeight * scale,
  );
  canvas.getContext('2d', { alpha: false }).drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  image.close?.();
  return canvas;
};

const median = values => {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)] || 0;
};

const sampleBackground = (data, width, height) => {
  const channels = [[], [], []];
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.015));
  const points = [];
  for (let step = 0; step <= 12; step += 1) {
    const x = Math.round(inset + (width - inset * 2 - 1) * step / 12);
    const y = Math.round(inset + (height - inset * 2 - 1) * step / 12);
    points.push([x, inset], [x, height - inset - 1]);
    points.push([inset, y], [width - inset - 1, y]);
  }
  points.forEach(([x, y]) => {
    const offset = (y * width + x) * 4;
    channels.forEach((channel, index) => {
      channel.push(data[offset + index]);
    });
  });
  return channels.map(median);
};

const colorDistance = (data, offset, background) => {
  const red = data[offset] - background[0];
  const green = data[offset + 1] - background[1];
  const blue = data[offset + 2] - background[2];
  return Math.sqrt(red * red + green * green + blue * blue);
};

const intersects = (first, second) => {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
  const minimumArea = Math.min(
    first.width * first.height,
    second.width * second.height,
  );
  return minimumArea > 0 && overlap / minimumArea > 0.55;
};

const sortRegions = regions => {
  const rowTolerance = median(regions.map(region => region.height)) * 0.45;
  return [...regions].sort((first, second) => {
    if (Math.abs(first.y - second.y) <= rowTolerance) {
      return first.x - second.x;
    }
    return first.y - second.y;
  }).map((region, index) => ({
    ...region,
    id: `auto-${index + 1}`,
  }));
};

const findProjectionRuns = (
  values,
  threshold,
  minimumLength,
) => {
  const runs = [];
  let start = -1;
  for (let index = 0; index <= values.length; index += 1) {
    const active = index < values.length && values[index] >= threshold;
    if (active && start < 0) start = index;
    if (!active && start >= 0) {
      if (index - start >= minimumLength) {
        runs.push({ start, end: index });
      }
      start = -1;
    }
  }
  return runs;
};

export const detectStructuredDeckRegions = sourceCanvas => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const context = sourceCanvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true,
  });
  const image = context.getImageData(0, 0, width, height);
  const foreground = new Uint8Array(width * height);
  const rowDensity = new Float32Array(height);

  for (let y = 0; y < height; y += 1) {
    let rowCount = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const level = grayscale(red, green, blue);
      if (maximum - minimum >= 24 || level < 155) {
        foreground[pixel] = 1;
        rowCount += 1;
      }
    }
    rowDensity[y] = rowCount / width;
  }

  const rowRuns = findProjectionRuns(
    rowDensity,
    0.12,
    Math.max(24, Math.round(height * 0.045)),
  );
  if (!rowRuns.length) return [];

  const rows = rowRuns.map(row => {
    const rowHeight = row.end - row.start;
    const columnDensity = new Float32Array(width);
    for (let x = 0; x < width; x += 1) {
      let columnCount = 0;
      for (let y = row.start; y < row.end; y += 1) {
        columnCount += foreground[y * width + x];
      }
      columnDensity[x] = columnCount / rowHeight;
    }
    return {
      ...row,
      runs: findProjectionRuns(
        columnDensity,
        0.15,
        Math.max(10, Math.round(width * 0.012)),
      ),
    };
  });
  const candidateWidths = rows.flatMap(row =>
    row.runs.map(run => run.end - run.start))
    .filter(value =>
      value >= width * 0.04 &&
      value <= width * 0.16);
  const expectedWidth = median(candidateWidths);
  if (!expectedWidth) return [];

  const cardRows = rows.map(row => {
    const rowHeight = row.end - row.start;
    const regions = row.runs.flatMap(run => {
      const runWidth = run.end - run.start;
      const count = runWidth > expectedWidth * 1.55
        ? Math.max(1, Math.round(runWidth / expectedWidth))
        : 1;
      const widthPerCard = runWidth / count;
      return Array.from({ length: count }, (_, index) => ({
        x: run.start + widthPerCard * index,
        y: row.start,
        width: widthPerCard,
        height: rowHeight,
      }));
    }).filter(region => {
      const aspect = region.width / region.height;
      return aspect >= 0.48 && aspect <= 0.9;
    });
    return {
      ...row,
      regions,
    };
  }).filter(row => row.regions.length);
  if (!cardRows.length) return [];

  const typicalHeight = median(cardRows.map(row => row.end - row.start));
  const sectionKeys = ['main', 'extra', 'side'];
  let sectionIndex = 0;
  const regions = [];
  cardRows.forEach((row, rowIndex) => {
    if (rowIndex > 0) {
      const previous = cardRows[rowIndex - 1];
      const gap = row.start - previous.end;
      if (gap > typicalHeight * 0.3) {
        sectionIndex += 1;
      }
    }
    const sectionHint = sectionKeys[Math.min(
      sectionIndex,
      sectionKeys.length - 1,
    )];
    row.regions.forEach(region => {
      regions.push({
        ...normalizeCardBounds(region, width, height),
        sectionHint,
      });
    });
  });
  if (regions.length < 2 || regions.length > 90) return [];
  return sortRegions(regions);
};

const normalizeCardBounds = (region, width, height) => {
  let boxWidth = region.width;
  let boxHeight = region.height;
  if (boxWidth / boxHeight < CARD_ASPECT_RATIO) {
    boxWidth = boxHeight * CARD_ASPECT_RATIO;
  } else {
    boxHeight = boxWidth / CARD_ASPECT_RATIO;
  }
  boxWidth *= 1.012;
  boxHeight *= 1.012;
  const x = Math.max(0, Math.min(
    width - boxWidth,
    region.x + region.width / 2 - boxWidth / 2,
  ));
  const y = Math.max(0, Math.min(
    height - boxHeight,
    region.y + region.height / 2 - boxHeight / 2,
  ));
  return {
    x,
    y,
    width: Math.min(boxWidth, width),
    height: Math.min(boxHeight, height),
  };
};

export const detectCardRegions = sourceCanvas => {
  const structuredRegions = detectStructuredDeckRegions(sourceCanvas);
  if (structuredRegions.length) return structuredRegions;
  const sourceAspect = sourceCanvas.width / sourceCanvas.height;
  if (Math.abs(sourceAspect - CARD_ASPECT_RATIO) < 0.045) {
    return [{
      id: 'auto-1',
      row: 0,
      column: 0,
      x: 0,
      y: 0,
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    }];
  }
  const scale = Math.min(
    1,
    MAX_DETECTION_SIDE /
      Math.max(sourceCanvas.width, sourceCanvas.height),
  );
  const canvas = createCanvas(
    sourceCanvas.width * scale,
    sourceCanvas.height * scale,
  );
  const context = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true,
  });
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const background = sampleBackground(
    image.data,
    canvas.width,
    canvas.height,
  );
  const blockSize = Math.max(
    2,
    Math.round(Math.min(canvas.width, canvas.height) / 180),
  );
  const columns = Math.ceil(canvas.width / blockSize);
  const rows = Math.ceil(canvas.height / blockSize);
  const mask = new Uint8Array(columns * rows);
  const threshold = 42;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.min(
        canvas.width - 1,
        column * blockSize + Math.floor(blockSize / 2),
      );
      const y = Math.min(
        canvas.height - 1,
        row * blockSize + Math.floor(blockSize / 2),
      );
      const offset = (y * canvas.width + x) * 4;
      if (colorDistance(image.data, offset, background) >= threshold) {
        mask[row * columns + column] = 1;
      }
    }
  }

  const connectedMask = new Uint8Array(mask);
  for (let row = 1; row < rows - 1; row += 1) {
    for (let column = 1; column < columns - 1; column += 1) {
      const index = row * columns + column;
      if (mask[index]) continue;
      const horizontal = mask[index - 1] && mask[index + 1];
      const vertical = mask[index - columns] && mask[index + columns];
      if (horizontal || vertical) connectedMask[index] = 1;
    }
  }

  const visited = new Uint8Array(connectedMask.length);
  const candidates = [];
  const minimumArea = columns * rows * 0.004;
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let start = 0; start < connectedMask.length; start += 1) {
    if (!connectedMask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let cursor = 0;
    let minimumX = columns;
    let maximumX = 0;
    let minimumY = rows;
    let maximumY = 0;
    let area = 0;
    while (cursor < queue.length) {
      const index = queue[cursor];
      cursor += 1;
      const x = index % columns;
      const y = Math.floor(index / columns);
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
      area += 1;
      directions.forEach(([deltaX, deltaY]) => {
        const nextX = x + deltaX;
        const nextY = y + deltaY;
        if (nextX < 0 || nextX >= columns ||
          nextY < 0 || nextY >= rows) {
          return;
        }
        const next = nextY * columns + nextX;
        if (connectedMask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      });
    }
    if (area < minimumArea) continue;
    const boxWidth = (maximumX - minimumX + 1) * blockSize;
    const boxHeight = (maximumY - minimumY + 1) * blockSize;
    const aspect = boxWidth / boxHeight;
    const fill = area /
      ((maximumX - minimumX + 1) * (maximumY - minimumY + 1));
    if (aspect < 0.48 || aspect > 0.9 || fill < 0.18) continue;
    candidates.push({
      x: minimumX * blockSize / scale,
      y: minimumY * blockSize / scale,
      width: Math.min(boxWidth / scale, sourceCanvas.width),
      height: Math.min(boxHeight / scale, sourceCanvas.height),
    });
  }

  const filtered = candidates
    .sort((first, second) =>
      second.width * second.height - first.width * first.height)
    .filter((candidate, index, values) =>
      values.slice(0, index).every(value => !intersects(candidate, value)))
    .slice(0, 60)
    .map(candidate => normalizeCardBounds(
      candidate,
      sourceCanvas.width,
      sourceCanvas.height,
    ));
  return sortRegions(filtered);
};

export const createSingleCardRegion = (widthValue, heightValue) => {
  const width = Math.max(1, Number(widthValue) || 1);
  const height = Math.max(1, Number(heightValue) || 1);
  const cardWidth = Math.min(width, height * CARD_ASPECT_RATIO);
  const cardHeight = cardWidth / CARD_ASPECT_RATIO;
  return [{
    id: 'single-1',
    row: 0,
    column: 0,
    x: (width - cardWidth) / 2,
    y: (height - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight,
  }];
};

const cropRegion = (sourceCanvas, region, options = {}) => {
  const width = options.width || 360;
  const height = options.height ||
    Math.round(width / CARD_ASPECT_RATIO);
  const canvas = createCanvas(width, height);
  canvas.getContext('2d', { alpha: false }).drawImage(
    sourceCanvas,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
};

export const createCropPreview = (sourceCanvas, region) => {
  return cropRegion(sourceCanvas, region)
    .toDataURL('image/jpeg', 0.88);
};

const grayscale = (red, green, blue) => {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
};

const getArtworkRegion = region => ({
  x: region.x + region.width * 0.11,
  y: region.y + region.height * 0.17,
  width: region.width * 0.78,
  height: region.height * 0.54,
});

const getFingerprintTileRegions = region => {
  const tileWidth = region.width * 0.54;
  const tileHeight = region.height * 0.54;
  return [
    {
      x: region.x,
      y: region.y,
      width: tileWidth,
      height: tileHeight,
    },
    {
      x: region.x + region.width - tileWidth,
      y: region.y,
      width: tileWidth,
      height: tileHeight,
    },
    {
      x: region.x,
      y: region.y + region.height - tileHeight,
      width: tileWidth,
      height: tileHeight,
    },
    {
      x: region.x + region.width - tileWidth,
      y: region.y + region.height - tileHeight,
      width: tileWidth,
      height: tileHeight,
    },
  ];
};

const createHashForRegion = (sourceCanvas, region) => {
  const canvas = createCanvas(9, 8);
  const context = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true,
  });
  context.drawImage(
    sourceCanvas,
    region.x,
    region.y,
    region.width,
    region.height,
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
  return hash.toString(16).padStart(16, '0');
};

const createAverageColor = (sourceCanvas, region) => {
  const canvas = createCanvas(8, 8);
  const context = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true,
  });
  context.drawImage(
    sourceCanvas,
    region.x,
    region.y,
    region.width,
    region.height,
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

export const createCardFingerprint = (sourceCanvas, region) => {
  const artworkRegion = getArtworkRegion(region);
  return {
    art: createHashForRegion(sourceCanvas, artworkRegion),
    full: createHashForRegion(sourceCanvas, region),
    color: createAverageColor(sourceCanvas, artworkRegion),
    tiles: getFingerprintTileRegions(artworkRegion)
      .map(tile => createHashForRegion(sourceCanvas, tile)),
  };
};

export const createDifferenceHash = (sourceCanvas, region) => {
  return createCardFingerprint(sourceCanvas, region).art;
};

export const createRecognitionGroups = (sourceCanvas, regions) => {
  const entries = regions.map(region => {
    const visualFingerprint = createCardFingerprint(
      sourceCanvas,
      region,
    );
    return {
      region,
      crop: createCropPreview(sourceCanvas, region),
      fingerprint: visualFingerprint.art,
      visualFingerprint,
    };
  });
  return groupRecognitionRegions(entries, 8);
};

export const loadCardFingerprintIndex = () => {
  if (!fingerprintIndexPromise) {
    fingerprintIndexPromise = fetch(FINGERPRINT_INDEX_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`卡图指纹加载失败 (${response.status})`);
        }
        return response.arrayBuffer();
      })
      .then(parseFingerprintIndex)
      .catch(error => {
        fingerprintIndexPromise = null;
        throw error;
      });
  }
  return fingerprintIndexPromise;
};

const otsuThreshold = data => {
  const histogram = new Uint32Array(256);
  let total = 0;
  let weightedTotal = 0;
  for (let index = 0; index < data.length; index += 4) {
    const level = grayscale(
      data[index],
      data[index + 1],
      data[index + 2],
    );
    histogram[level] += 1;
    total += 1;
    weightedTotal += level;
  }
  let backgroundWeight = 0;
  let backgroundTotal = 0;
  let maximumVariance = -1;
  let threshold = 128;
  for (let level = 0; level < 256; level += 1) {
    backgroundWeight += histogram[level];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundTotal += level * histogram[level];
    const backgroundMean = backgroundTotal / backgroundWeight;
    const foregroundMean =
      (weightedTotal - backgroundTotal) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight *
      (backgroundMean - foregroundMean) ** 2;
    if (variance > maximumVariance) {
      maximumVariance = variance;
      threshold = level;
    }
  }
  return threshold;
};

const createNumberStrip = (sourceCanvas, region, variant = 0) => {
  const source = variant === 0
    ? { x: 0.025, y: 0.92, width: 0.46, height: 0.075 }
    : { x: 0.025, y: 0.94, width: 0.42, height: 0.05 };
  const canvas = createCanvas(1500, 260);
  const context = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true,
  });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    sourceCanvas,
    region.x + region.width * source.x,
    region.y + region.height * source.y,
    region.width * source.width,
    region.height * source.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const threshold = variant === 0
    ? 135
    : Math.min(135, otsuThreshold(image.data));
  let darkPixels = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const level = grayscale(
      image.data[index],
      image.data[index + 1],
      image.data[index + 2],
    );
    if (level <= threshold) darkPixels += 1;
  }
  const invert = darkPixels > image.data.length / 8;
  for (let index = 0; index < image.data.length; index += 4) {
    const level = grayscale(
      image.data[index],
      image.data[index + 1],
      image.data[index + 2],
    );
    const dark = level <= threshold;
    const value = dark === invert ? 255 : 0;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
};

export const createDigitRecognizer = async onProgress => {
  const {
    createWorker,
    PSM,
  } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: message => onProgress?.(message),
  });
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    preserve_interword_spaces: '0',
  });

  return {
    async recognize(sourceCanvas, region) {
      const attempts = [];
      for (let variant = 0; variant < 2; variant += 1) {
        const strip = createNumberStrip(
          sourceCanvas,
          region,
          variant,
        );
        const result = await worker.recognize(strip);
        attempts.push({
          text: result.data.text || '',
          confidence: Number(result.data.confidence) || 0,
        });
        const candidates = extractCardIdCandidates(
          attempts.map(item => item.text).join('\n'),
        );
        if (candidates.length) {
          return {
            candidates,
            text: attempts.map(item => item.text).join(' · ').trim(),
            confidence: Math.max(...attempts.map(item => item.confidence)),
          };
        }
      }
      return {
        candidates: [],
        text: attempts.map(item => item.text).join(' · ').trim(),
        confidence: Math.max(
          0,
          ...attempts.map(item => item.confidence),
        ),
      };
    },
    terminate() {
      return worker.terminate();
    },
  };
};
