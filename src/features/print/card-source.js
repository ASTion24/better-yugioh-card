const YGOCDB_API_BASE = 'https://ygocdb.com/api/v0';
const IMAGE_PROXY_BASE = 'https://wsrv.nl/?url=';
const IMAGE_CACHE_NAME = 'yugioh-print-images-v1';
export const PRERELEASE_PACK_URL = 'https://cdntx.moecube.com/ygopro-super-pre/archive/ygopro-super-pre.ypk';
const PRERELEASE_ARCHIVE_CACHE_NAME = 'yugioh-prerelease-archive-v1';
const PRERELEASE_ARCHIVE_METADATA_KEY = 'yugioh-prerelease-archive-v1';
const PRERELEASE_UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

const RAW_CARD_IMAGE_TEMPLATE = {
  zh: 'https://cdn.233.momobako.com/ygoimg/ygopro/{id}.webp',
  sc: 'https://cdn.233.momobako.com/ygoimg/sc/{id}.webp',
  jp: 'https://cdn.233.momobako.com/ygoimg/jp/{id}.webp',
  en: 'https://cdn.233.momobako.com/ygoimg/en/{id}.webp',
};
const PRERELEASE_IMAGE_TEMPLATE = 'https://cdn.233.momobako.com/ygopro/pics/{id}.jpg';

let idChangelogPromise = null;
let prereleaseArchivePromise = null;
let prereleaseCardRecordsPromise = null;
let prereleaseArchiveVersion = '';
let prereleaseArchiveLastCheckedAt = 0;
const cardDataPromiseMap = new Map();
const imageDataPromiseMap = new Map();
const prereleaseImageDataPromiseMap = new Map();
const searchPromiseMap = new Map();

const pathCardId = cardId => String(cardId).replace(/^0+/, '') || '0';

export const getCardArtworkId = card => {
  return pathCardId(card?.artid || card?.altart || card?.id || '0');
};

export const getCardDisplayName = card => {
  return String(
    card?.sc_name || card?.cn_name || card?.md_name ||
    card?.jp_name || card?.en_name || '',
  ).trim();
};

export const isAlternateArtworkCard = (card, requestedId) => {
  const normalizedId = pathCardId(requestedId);
  return getCardArtworkId(card) === normalizedId &&
    pathCardId(card?.id || '0') !== normalizedId;
};

export const isPrereleaseCardId = cardId => {
  return /^10\d{7}$/.test(pathCardId(cardId));
};

const proxiedImageUrl = (rawUrl, proxyBase = IMAGE_PROXY_BASE) => {
  const proxyTarget = rawUrl.replace(/^https?:\/\//, '');
  return `${proxyBase}${encodeURI(proxyTarget)}&output=jpg&q=94`;
};

const fetchResponse = async (
  url,
  options = {},
  attempts = 3,
  timeoutMs = 20000,
) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = options.signal ? null : new AbortController();
    const timeout = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
      });
      if (!response.ok) {
        throw new Error(`请求失败 (${response.status})`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts && !options.signal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  throw lastError;
};

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
  reader.readAsDataURL(blob);
});

const readPrereleaseArchiveMetadata = () => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const value = JSON.parse(localStorage.getItem(PRERELEASE_ARCHIVE_METADATA_KEY) || 'null');
    return value?.url ? value : null;
  } catch {
    return null;
  }
};

const writePrereleaseArchiveMetadata = metadata => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(PRERELEASE_ARCHIVE_METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Cache storage remains usable when local storage is unavailable.
  }
};

const getPrereleaseArchiveCache = async () => {
  if (typeof caches === 'undefined') {
    return null;
  }
  try {
    return await caches.open(PRERELEASE_ARCHIVE_CACHE_NAME);
  } catch {
    return null;
  }
};

export const getPrereleaseArchiveVersion = response => {
  return response.headers.get('etag') || response.url || '';
};

const readImageCache = async url => {
  if (typeof caches === 'undefined') {
    return null;
  }
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    return await cache.match(url);
  } catch {
    return null;
  }
};

const writeImageCache = async (url, response) => {
  if (typeof caches === 'undefined') {
    return;
  }
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    await cache.put(url, response);
  } catch {
    // Memory caching still keeps the current generation reliable.
  }
};

export const getRawCardImageUrl = (cardId, language = 'zh') => {
  if (isPrereleaseCardId(cardId)) {
    return PRERELEASE_IMAGE_TEMPLATE.replace('{id}', pathCardId(cardId));
  }
  const template = RAW_CARD_IMAGE_TEMPLATE[language] || RAW_CARD_IMAGE_TEMPLATE.zh;
  return template.replace('{id}', pathCardId(cardId));
};

export const getFullCardImageUrl = (cardId, language = 'zh') => {
  return proxiedImageUrl(getRawCardImageUrl(cardId, language));
};

export const getCardPreviewUrl = (cardId, language = 'sc') => {
  return getRawCardImageUrl(cardId, language);
};

export const getArtworkImageUrl = cardId => {
  const rawUrl = `https://images.ygoprodeck.com/images/cards_cropped/${pathCardId(cardId)}.jpg`;
  return proxiedImageUrl(rawUrl);
};

export const getCardThumbnailUrl = cardId => {
  return `${getRawCardImageUrl(cardId, 'zh')}!thumb2`;
};

export const searchCardDatabase = query => {
  const keyword = query.trim();
  if (!keyword) {
    return Promise.resolve([]);
  }
  if (searchPromiseMap.has(keyword)) {
    return searchPromiseMap.get(keyword);
  }
  const promise = (async () => {
    if (isPrereleaseCardId(keyword)) {
      return searchPrereleaseCardDatabase(keyword);
    }
    const url = new URL(`${YGOCDB_API_BASE}/`);
    url.searchParams.set('search', keyword);
    const officialPromise = fetchResponse(url)
      .then(response => response.json())
      .then(data => Array.isArray(data?.result) ? data.result : []);
    if (/^\d+$/.test(keyword)) {
      const officialResults = await officialPromise;
      return officialResults.length
        ? officialResults
        : searchPrereleaseCardDatabase(keyword);
    }
    const [official, prerelease] = await Promise.allSettled([
      officialPromise,
      searchPrereleaseCardDatabase(keyword),
    ]);
    if (official.status === 'rejected' && prerelease.status === 'rejected') {
      throw official.reason;
    }
    const results = [
      ...(official.status === 'fulfilled' ? official.value : []),
      ...(prerelease.status === 'fulfilled' ? prerelease.value : []),
    ];
    const uniqueResults = [
      ...new Map(results.map(result => [getCardArtworkId(result), result])).values(),
    ];
    const normalizedKeyword = keyword.toLocaleLowerCase();
    const getScore = result => {
      const name = String(
        result.sc_name || result.cn_name || result.md_name ||
        result.jp_name || result.en_name || '',
      ).toLocaleLowerCase();
      if (String(result.id) === normalizedKeyword || name === normalizedKeyword) return 0;
      if (name.startsWith(normalizedKeyword)) return 1;
      if (name.includes(normalizedKeyword)) return 2;
      return 3;
    };
    return uniqueResults.sort((first, second) => getScore(first) - getScore(second));
  })()
    .catch(error => {
      searchPromiseMap.delete(keyword);
      throw error;
    });
  searchPromiseMap.set(keyword, promise);
  return promise;
};

export const fetchIdChangelog = () => {
  if (!idChangelogPromise) {
    idChangelogPromise = fetchResponse(`${YGOCDB_API_BASE}/idChangelog.jsonp?callback=`)
      .then(response => response.json())
      .catch(() => ({}));
  }
  return idChangelogPromise;
};

export const normalizeCardId = (cardId, idChangelog = {}) => {
  let current = cardId;
  const visited = new Set();
  while (idChangelog[current] !== undefined && !visited.has(current)) {
    visited.add(current);
    current = String(idChangelog[current]);
  }
  return current;
};

export const normalizeCardIds = (cardIds, idChangelog = {}) => {
  return cardIds.map(cardId => normalizeCardId(cardId, idChangelog));
};

export const fetchCardData = cardId => {
  if (cardDataPromiseMap.has(cardId)) {
    return cardDataPromiseMap.get(cardId);
  }
  const promise = fetchResponse(`${YGOCDB_API_BASE}/card/${encodeURIComponent(cardId)}?show=all`)
    .then(response => response.json())
    .then(data => {
      if (!data?.id) {
        throw new Error(`未找到卡片 ${cardId}`);
      }
      return data;
    })
    .catch(error => {
      cardDataPromiseMap.delete(cardId);
      throw error;
    });
  cardDataPromiseMap.set(cardId, promise);
  return promise;
};

export const fetchImageDataUrl = url => {
  if (imageDataPromiseMap.has(url)) {
    return imageDataPromiseMap.get(url);
  }
  const promise = (async () => {
    const cachedResponse = await readImageCache(url);
    const response = cachedResponse || await fetchResponse(url, {}, 2, 15000);
    if (!cachedResponse) {
      await writeImageCache(url, response.clone());
    }
    return blobToDataUrl(await response.blob());
  })().catch(error => {
    imageDataPromiseMap.delete(url);
    throw error;
  });
  imageDataPromiseMap.set(url, promise);
  return promise;
};

const fetchLatestPrereleaseArchiveResponse = async () => {
  const cachedMetadata = readPrereleaseArchiveMetadata();
  const archiveCache = await getPrereleaseArchiveCache();

  try {
    // The CDN redirects this stable URL to a versioned asset. Browsers use the
    // upstream ETag for this no-cache revalidation without exposing the header
    // to cross-origin JavaScript, then return the cached body on a 304.
    const response = await fetchResponse(PRERELEASE_PACK_URL, {
      cache: 'no-cache',
    });
    if (response.status === 304 && cachedMetadata?.url) {
      const cachedResponse = await archiveCache?.match(cachedMetadata.url);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    const version = getPrereleaseArchiveVersion(response);
    const url = response.url || PRERELEASE_PACK_URL;
    if (cachedMetadata?.version === version && cachedMetadata.url === url) {
      const cachedResponse = await archiveCache?.match(url);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const metadata = {
      url,
      version,
      etag: response.headers.get('etag') || '',
    };
    await archiveCache?.put(metadata.url, response.clone());
    writePrereleaseArchiveMetadata(metadata);
    return response;
  } catch (error) {
    if (cachedMetadata?.url) {
      const cachedResponse = await archiveCache?.match(cachedMetadata.url);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    throw error;
  }
};

const fetchPrereleaseArchive = async () => {
  const shouldCheckForUpdate = !prereleaseArchivePromise ||
    Date.now() - prereleaseArchiveLastCheckedAt >= PRERELEASE_UPDATE_CHECK_INTERVAL_MS;
  if (!shouldCheckForUpdate) {
    return prereleaseArchivePromise;
  }

  prereleaseArchiveLastCheckedAt = Date.now();
  const previousVersion = prereleaseArchiveVersion;
  prereleaseArchivePromise = (async () => {
    const response = await fetchLatestPrereleaseArchiveResponse();
    const version = getPrereleaseArchiveVersion(response) ||
      readPrereleaseArchiveMetadata()?.version || '';
    if (previousVersion && version && previousVersion !== version) {
      prereleaseCardRecordsPromise = null;
      prereleaseImageDataPromiseMap.clear();
    }
    prereleaseArchiveVersion = version;
    const { unzipSync } = await import('fflate');
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()), {
      filter: file => {
        return /^pics\/[^/]+\.jpg$/i.test(file.name) ||
          /^test-(release|update)\.cdb$/i.test(file.name);
      },
    });
    return archive;
  })().catch(error => {
    prereleaseArchivePromise = null;
    throw error;
  });
  return prereleaseArchivePromise;
};

export const fetchPrereleaseImageDataUrl = async cardId => {
  const normalizedId = pathCardId(cardId);
  if (!isPrereleaseCardId(normalizedId)) {
    throw new Error(`${cardId} 不是先行卡编号`);
  }
  const archive = await fetchPrereleaseArchive();
  if (prereleaseImageDataPromiseMap.has(normalizedId)) {
    return prereleaseImageDataPromiseMap.get(normalizedId);
  }
  const promise = (async () => {
    const image = archive[`pics/${normalizedId}.jpg`];
    if (!image) {
      throw new Error(`超先行卡包中未找到卡片 ${normalizedId}`);
    }
    return blobToDataUrl(new Blob([image], { type: 'image/jpeg' }));
  })().catch(error => {
    prereleaseImageDataPromiseMap.delete(normalizedId);
    throw error;
  });
  prereleaseImageDataPromiseMap.set(normalizedId, promise);
  return promise;
};

const splitPrereleaseDescription = description => {
  const value = String(description || '').replace(/\r\n/g, '\n');
  const marker = '【怪兽效果】';
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) {
    return { desc: value, pdesc: '' };
  }
  const pendulumBlock = value.slice(0, markerIndex).trim();
  return {
    pdesc: pendulumBlock.replace(/^←.*?→\s*/u, '').trim(),
    desc: value.slice(markerIndex + marker.length).trim(),
  };
};

const loadPrereleaseCardRecords = async () => {
  const archive = await fetchPrereleaseArchive();
  if (prereleaseCardRecordsPromise) {
    return prereleaseCardRecordsPromise;
  }
  prereleaseCardRecordsPromise = (async () => {
    const [{ default: initSqlJs }, { default: sqlWasmUrl }] = await Promise.all([
      import('sql.js'),
      import('sql.js/dist/sql-wasm.wasm?url'),
    ]);
    const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
    const recordMap = new Map();
    ['test-release.cdb', 'test-update.cdb'].forEach(filename => {
      const databaseBytes = archive[filename];
      if (!databaseBytes) {
        return;
      }
      const database = new SQL.Database(databaseBytes);
      const [result] = database.exec(`
        SELECT d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def,
          d.level, d.race, d.attribute, d.category, t.name, t.desc
        FROM datas d
        INNER JOIN texts t ON t.id = d.id
      `);
      result?.values.forEach(values => {
        const row = Object.fromEntries(result.columns.map((column, index) => [column, values[index]]));
        if (!isPrereleaseCardId(String(row.id))) {
          return;
        }
        const descriptions = splitPrereleaseDescription(row.desc);
        recordMap.set(String(row.id), {
          id: row.id,
          sc_name: row.name,
          cn_name: row.name,
          prerelease: true,
          data: {
            ot: row.ot,
            alias: row.alias,
            setcode: row.setcode,
            type: row.type,
            atk: row.atk,
            def: row.def,
            level: row.level,
            race: row.race,
            attribute: row.attribute,
            category: row.category,
          },
          text: {
            name: row.name,
            sc_name: row.name,
            types: '先行卡',
            desc: descriptions.desc,
            pdesc: descriptions.pdesc,
          },
        });
      });
      database.close();
    });
    return [...recordMap.values()];
  })().catch(error => {
    prereleaseCardRecordsPromise = null;
    throw error;
  });
  return prereleaseCardRecordsPromise;
};

export const fetchPrereleaseCardData = async cardId => {
  const normalizedId = pathCardId(cardId);
  if (!isPrereleaseCardId(normalizedId)) {
    throw new Error(`${cardId} 不是先行卡编号`);
  }
  const records = await loadPrereleaseCardRecords();
  const card = records.find(record => String(record.id) === normalizedId);
  if (!card) {
    throw new Error(`超先行卡数据库中未找到卡片 ${normalizedId}`);
  }
  return card;
};

export async function searchPrereleaseCardDatabase(query) {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) {
    return [];
  }
  const records = await loadPrereleaseCardRecords();
  return records
    .filter(card => {
      return String(card.id) === keyword ||
        card.sc_name.toLocaleLowerCase().includes(keyword) ||
        card.text.desc.toLocaleLowerCase().includes(keyword);
    })
    .sort((first, second) => {
      const firstExact = String(first.id) === keyword || first.sc_name.toLocaleLowerCase() === keyword;
      const secondExact = String(second.id) === keyword || second.sc_name.toLocaleLowerCase() === keyword;
      return Number(secondExact) - Number(firstExact);
    })
    .slice(0, 20);
}

export const extractPrereleaseArtworkDataUrl = async cardId => {
  const source = await fetchPrereleaseImageDataUrl(cardId);
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');
  const sourceX = Math.round(image.naturalWidth * 0.115);
  const sourceY = Math.round(image.naturalHeight * 0.178);
  const sourceSize = Math.round(image.naturalWidth * 0.775);
  canvas.width = 624;
  canvas.height = 624;
  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/jpeg', 0.94);
};

export const fetchCardImageDataUrl = async (cardId, language = 'zh') => {
  try {
    return await fetchImageDataUrl(getFullCardImageUrl(cardId, language));
  } catch (error) {
    if (!isPrereleaseCardId(cardId)) {
      throw error;
    }
    return fetchPrereleaseImageDataUrl(cardId);
  }
};

export const clearImageCache = async () => {
  imageDataPromiseMap.clear();
  prereleaseImageDataPromiseMap.clear();
  if (typeof caches !== 'undefined') {
    await caches.delete(IMAGE_CACHE_NAME);
  }
};
