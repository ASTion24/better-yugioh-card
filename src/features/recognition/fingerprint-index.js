const HEADER_SIZE = 12;
const MAGIC = [89, 71, 70, 80];

const popcount32 = value => {
  let number = value >>> 0;
  number -= number >>> 1 & 0x55555555;
  number = (number & 0x33333333) + (number >>> 2 & 0x33333333);
  return ((number + (number >>> 4) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

const splitHash = value => {
  try {
    const hash = BigInt(`0x${value}`);
    return {
      low: Number(hash & 0xffffffffn) >>> 0,
      high: Number(hash >> 32n & 0xffffffffn) >>> 0,
    };
  } catch {
    return { low: 0, high: 0 };
  }
};

const hashDistance = (first, low, high) => {
  return popcount32(first.low ^ low) +
    popcount32(first.high ^ high);
};

const colorDistance = (first, red, green, blue) => {
  const redDelta = first[0] - red;
  const greenDelta = first[1] - green;
  const blueDelta = first[2] - blue;
  return Math.sqrt(
    redDelta * redDelta +
    greenDelta * greenDelta +
    blueDelta * blueDelta,
  );
};

export const parseFingerprintIndex = value => {
  const buffer = value instanceof ArrayBuffer
    ? value
    : value?.buffer;
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < HEADER_SIZE) {
    throw new Error('卡图指纹索引无效');
  }
  const byteOffset = value instanceof ArrayBuffer
    ? 0
    : value.byteOffset || 0;
  const byteLength = value instanceof ArrayBuffer
    ? value.byteLength
    : value.byteLength;
  const bytes = new Uint8Array(buffer, byteOffset, byteLength);
  if (MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new Error('卡图指纹索引格式不受支持');
  }
  const view = new DataView(buffer, byteOffset, byteLength);
  const version = view.getUint16(4, true);
  const recordSize = view.getUint16(6, true);
  const declaredCount = view.getUint32(8, true);
  if (![1, 2].includes(version) ||
    recordSize < (version === 2 ? 56 : 24)) {
    throw new Error('卡图指纹索引版本不受支持');
  }
  const availableCount = Math.floor(
    (byteLength - HEADER_SIZE) / recordSize,
  );
  if (declaredCount > availableCount) {
    throw new Error('卡图指纹索引数据不完整');
  }
  return {
    view,
    count: declaredCount,
    recordSize,
    byteOffset,
    version,
  };
};

const insertMatch = (matches, match, limit) => {
  const index = matches.findIndex(item => match.score < item.score);
  if (index < 0) {
    matches.push(match);
  } else {
    matches.splice(index, 0, match);
  }
  if (matches.length > limit) matches.pop();
};

const getConfidence = (best, next) => {
  if (!best) return 0;
  const margin = next ? next.score - best.score : 16;
  if (Number.isFinite(best.tileDistance)) {
    if (best.tileDistance <= 7 &&
      best.score <= 11 &&
      margin >= 2) {
      return 96;
    }
    if (best.tileDistance <= 11 &&
      best.score <= 16 &&
      margin >= 3) {
      return 90;
    }
    if (best.tileDistance <= 14 &&
      best.score <= 20 &&
      margin >= 4) {
      return 86;
    }
    if (best.tileDistance <= 15 &&
      best.score <= 22.5 &&
      margin >= 8) {
      return 90;
    }
    if (best.tileDistance <= 17 &&
      best.score <= 24 &&
      margin >= 10) {
      return 86;
    }
    if (best.tileDistance <= 19 &&
      best.score <= 26 &&
      margin >= 7) {
      return 86;
    }
    if (best.score <= 22 && margin >= 2) {
      return 68;
    }
    if (best.score <= 28 && margin >= 5) {
      return 68;
    }
    if (best.score <= 34 && margin >= 0.5) {
      return 48;
    }
    return 0;
  }
  if (best.artDistance <= 3 &&
    best.fullDistance <= 8 &&
    best.colorDistance <= 70 &&
    margin >= 2) {
    return 96;
  }
  if (best.artDistance <= 10 &&
    best.fullDistance <= 18 &&
    best.colorDistance <= 60 &&
    margin >= 6) {
    return 90;
  }
  if (best.artDistance <= 14 &&
    best.fullDistance <= 18 &&
    best.colorDistance <= 80 &&
    margin >= 5) {
    return 86;
  }
  if (best.artDistance <= 6 &&
    best.colorDistance <= 95 &&
    margin >= 2.5) {
    return 86;
  }
  if (best.artDistance <= 10 &&
    best.colorDistance <= 125 &&
    margin >= 1.5) {
    return 68;
  }
  return 0;
};

export const matchFingerprint = (
  index,
  fingerprint,
  limitValue = 5,
) => {
  if (!index?.view || !fingerprint?.art || !fingerprint?.full) {
    return [];
  }
  const limit = Math.min(10, Math.max(1, Math.trunc(limitValue) || 5));
  const art = splitHash(fingerprint.art);
  const full = splitHash(fingerprint.full);
  const tiles = Array.isArray(fingerprint.tiles)
    ? fingerprint.tiles.slice(0, 4).map(splitHash)
    : [];
  const color = Array.isArray(fingerprint.color)
    ? fingerprint.color
    : [0, 0, 0];
  const matches = [];
  for (let record = 0; record < index.count; record += 1) {
    const offset = HEADER_SIZE + record * index.recordSize;
    const id = index.view.getUint32(offset, true);
    const artDistance = hashDistance(
      art,
      index.view.getUint32(offset + 4, true),
      index.view.getUint32(offset + 8, true),
    );
    const fullDistance = hashDistance(
      full,
      index.view.getUint32(offset + 12, true),
      index.view.getUint32(offset + 16, true),
    );
    const averageColorDistance = colorDistance(
      color,
      index.view.getUint8(offset + 20),
      index.view.getUint8(offset + 21),
      index.view.getUint8(offset + 22),
    );
    const tileDistances = index.version >= 2 && tiles.length === 4
      ? tiles.map((tile, tileIndex) => hashDistance(
          tile,
          index.view.getUint32(offset + 24 + tileIndex * 8, true),
          index.view.getUint32(offset + 28 + tileIndex * 8, true),
        ))
      : [];
    const sortedTileDistances = [...tileDistances]
      .sort((first, second) => first - second);
    const tileDistance = sortedTileDistances.length
      ? (
          sortedTileDistances[0] +
          sortedTileDistances[1] +
          sortedTileDistances[2] * 0.5
        ) / 2.5
      : Number.NaN;
    const score = Number.isFinite(tileDistance)
      ? artDistance * 0.3 +
        fullDistance * 0.12 +
        tileDistance * 1.05 +
        averageColorDistance / 34
      : artDistance +
        fullDistance * 0.28 +
        averageColorDistance / 28;
    insertMatch(matches, {
      id: String(id),
      score,
      artDistance,
      fullDistance,
      colorDistance: averageColorDistance,
      tileDistance,
      tileDistances,
      confidence: 0,
    }, limit);
  }
  if (matches.length) {
    matches[0].confidence = getConfidence(matches[0], matches[1]);
  }
  return matches;
};
