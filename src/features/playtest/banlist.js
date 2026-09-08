const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const FORMAT_FIELDS = {
  ocg: 'ban_ocg',
  tcg: 'ban_tcg',
};
const STATUS_LIMITS = {
  Forbidden: 0,
  Limited: 1,
  'Semi-Limited': 2,
};

const normalizeId = value => String(value ?? '').replace(/^0+/, '') || '0';
const isOfficialId = value => /^\d{1,8}$/.test(normalizeId(value));

const chunk = (values, size) => {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

export const parseBanlistOverrides = value => {
  const limits = {};
  const errors = [];
  String(value || '').split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^(\d{1,9})\s*[=:,\s]\s*([0-3])$/);
    if (!match) {
      errors.push(`第 ${index + 1} 行格式无效`);
      return;
    }
    limits[normalizeId(match[1])] = Number(match[2]);
  });
  return { limits, errors };
};

export const fetchBanlistForCards = async (
  cardIds,
  format,
  options = {},
) => {
  const field = FORMAT_FIELDS[format];
  if (!field) {
    throw new Error('当前赛制需要手动录入禁限数量');
  }
  const request = options.fetch || fetch;
  const ids = [...new Set(cardIds.map(normalizeId).filter(isOfficialId))];
  const limits = {};
  const names = {};
  const checkedCardIds = [];
  for (const group of chunk(ids, 30)) {
    const url = new URL(API_URL);
    url.searchParams.set('id', group.join(','));
    const response = await request(url);
    if (!response.ok) {
      throw new Error(`禁限卡表查询失败 (${response.status})`);
    }
    const payload = await response.json();
    (payload?.data || []).forEach(card => {
      const id = normalizeId(card.id);
      checkedCardIds.push(id);
      names[id] = String(card.name || id);
      const status = card.banlist_info?.[field];
      if (STATUS_LIMITS[status] !== undefined) {
        limits[id] = STATUS_LIMITS[status];
      }
    });
  }
  return {
    format,
    effectiveDate: new Date().toISOString().slice(0, 10),
    checkedAt: new Date().toISOString(),
    checkedCardIds,
    limits,
    names,
  };
};

const countCards = cardIds => {
  const counts = new Map();
  cardIds.forEach(cardId => {
    const id = normalizeId(cardId);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
};

export const inspectBanlist = (deck, banlist) => {
  const cardIds = [
    ...(deck?.main || []),
    ...(deck?.extra || []),
    ...(deck?.side || []),
  ];
  const counts = countCards(cardIds);
  const limits = banlist?.limits || {};
  const checked = new Set((banlist?.checkedCardIds || []).map(normalizeId));
  const violations = [];
  const unknownIds = [];
  counts.forEach((count, id) => {
    if (!isOfficialId(id) || !checked.has(id)) {
      unknownIds.push(id);
      return;
    }
    const limit = limits[id] ?? 3;
    if (count > limit) {
      violations.push({
        id,
        name: banlist?.names?.[id] || id,
        count,
        limit,
      });
    }
  });
  return {
    checkedCount: checked.size,
    violations,
    unknownIds,
  };
};
