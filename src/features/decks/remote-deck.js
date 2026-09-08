import {
  parseDeckInput,
  parseOurygoDeckUrl,
  parseYdk,
} from '../print/ydk.js';

const YGOPRODECK_HOSTS = new Set(['ygoprodeck.com', 'www.ygoprodeck.com']);
const DIRECT_DECK_HOSTS = new Set([
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
]);

const readResponseText = async response => {
  if (!response.ok) {
    throw new Error(`卡组链接请求失败 (${response.status})`);
  }
  const text = await response.text();
  if (text.length > 2_000_000) {
    throw new Error('远程卡组内容超过 2 MB');
  }
  return text;
};

export const parseYgoprodeckPage = (html, sourceUrl = '') => {
  const sections = {
    main: 'main_deck',
    extra: 'extra_deck',
    side: 'side_deck',
  };
  const scriptSections = {
    main: 'maindeckjs',
    extra: 'extradeckjs',
    side: 'sidedeckjs',
  };
  const deck = {
    main: [],
    extra: [],
    side: [],
    warnings: [],
    source: 'ygoprodeck',
    sourceUrl,
  };

  Object.entries(sections).forEach(([section, elementId]) => {
    const start = html.search(new RegExp(`id=["']${elementId}["']`, 'i'));
    if (start < 0) return;
    const followingStarts = Object.values(sections)
      .map(id => html.slice(start + 1).search(new RegExp(`id=["']${id}["']`, 'i')))
      .filter(index => index >= 0)
      .map(index => index + start + 1);
    const end = followingStarts.length ? Math.min(...followingStarts) : html.length;
    const block = html.slice(start, end);
    deck[section] = [...block.matchAll(/data-card=["'](\d{1,12})["']/gi)]
      .map(match => match[1]);
  });
  Object.entries(scriptSections).forEach(([section, variableName]) => {
    if (deck[section].length) return;
    const match = html.match(new RegExp(
      `var\\s+${variableName}\\s*=\\s*(['"])(\\[[^;]*\\])\\1\\s*;`,
      'i',
    ));
    if (!match) return;
    try {
      const ids = JSON.parse(match[2]);
      deck[section] = Array.isArray(ids)
        ? ids.map(String).filter(id => /^\d{1,12}$/.test(id))
        : [];
    } catch {
      deck.warnings.push(`无法解析 ${section} 卡组数据`);
    }
  });

  const nameMatch = html.match(/var\s+deckname\s*=\s*(["'])(.*?)\1\s*;/i) ||
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)/i);
  deck.name = nameMatch?.[2] || nameMatch?.[1] || '';
  if (!deck.main.length && !deck.extra.length && !deck.side.length) {
    throw new Error('YGOPRODeck 页面中没有找到卡组数据');
  }
  return deck;
};

const fetchYgoprodeck = async url => {
  let response;
  try {
    response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`卡组链接请求失败 (${response.status})`);
    }
  } catch {
    const proxyBase = import.meta.env?.VITE_DECK_SOURCE_PROXY ||
      '/api/deck-source';
    const proxyUrl = `${proxyBase}?url=${encodeURIComponent(url)}`;
    response = await fetch(proxyUrl);
  }
  return parseYgoprodeckPage(await readResponseText(response), url);
};

const fetchDirectYdk = async url => {
  const response = await fetch(url, { mode: 'cors' });
  const deck = parseYdk(await readResponseText(response));
  return {
    ...deck,
    name: decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
      .replace(/\.ydk$/i, ''),
    source: 'remote-ydk',
    sourceUrl: url,
  };
};

export const resolveDeckInput = async input => {
  const normalized = input.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return parseDeckInput(normalized);
  }

  const url = new URL(normalized);
  if (url.hostname.toLowerCase() === 'deck.ourygo.top') {
    return parseOurygoDeckUrl(normalized);
  }
  if (YGOPRODECK_HOSTS.has(url.hostname.toLowerCase())) {
    return fetchYgoprodeck(normalized);
  }
  if (
    DIRECT_DECK_HOSTS.has(url.hostname.toLowerCase()) ||
    url.pathname.toLowerCase().endsWith('.ydk')
  ) {
    return fetchDirectYdk(normalized);
  }
  throw new Error('暂不支持这个卡组链接；可使用 YDK、GitHub Raw、YGOPRODeck 或 OURYGO');
};
