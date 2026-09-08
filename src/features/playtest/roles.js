export const CARD_ROLES = [
  { id: 'starter', label: '初动', color: '#b64734' },
  { id: 'extender', label: '补点', color: '#277568' },
  { id: 'handtrap', label: '手坑', color: '#315f8f' },
  { id: 'boardbreaker', label: '解场', color: '#967126' },
  { id: 'brick', label: '废件', color: '#78564f' },
  { id: 'fallback', label: '其他', color: '#665993' },
];

export const ROLE_COLOR_PALETTE = [
  '#a13d2d',
  '#28766b',
  '#315f8f',
  '#967126',
  '#78564f',
  '#665993',
  '#4c6b43',
  '#9b4f76',
];

export const KNOWN_HAND_TRAPS = new Map([
  ['14558127', '灰流丽'],
  ['23434538', '增殖的G'],
  ['97268402', '效果遮蒙者'],
  ['10045474', '无限泡影'],
  ['27204311', '原始生命态 尼比鲁'],
  ['94145021', '小丑与锁鸟'],
  ['59438930', '幽鬼兔'],
  ['73642296', '屋敷童'],
  ['52038441', '朔夜时雨'],
  ['60643553', '儚无水木'],
  ['91800273', '次元吸引者'],
  ['24508238', 'D.D.乌鸦'],
  ['38814750', 'PSY骨架装备·γ'],
  ['34267821', '古遗物-圣枪'],
  ['67750322', '骷髅大王'],
  ['62015408', '浮幽樱'],
  ['17266660', '朱光之宣告者'],
  ['78661338', '幻创龙 奇幻龙人神'],
  ['58655504', '禁采令地精灵'],
  ['46502744', '应战的G'],
  ['33854624', '深渊之兽 玛格巨龙'],
  ['6637331', '深渊之兽 德鲁伊鳞虫'],
  ['60242223', '深渊之兽 萨隆魔龙'],
  ['72656408', '深渊之兽 巴尔德鸟龙兽'],
  ['84192580', '欢聚友伴·抖抖海月水母'],
  ['42141493', '欢聚友伴·茸茸长尾山雀'],
  ['87126721', '欢聚友伴·喵喵豹猫'],
  ['97045737', '圣王的粉碎'],
  ['40366667', '灵王的波动'],
  ['42091632', '命王的螺旋'],
  ['6325660', '霆王的闪光'],
]);

const normalizeId = value => String(value ?? '').replace(/^0+/, '') || '0';
const BUILT_IN_ROLE_IDS = new Set(CARD_ROLES.map(role => role.id));

export const normalizeCustomRoles = roles => {
  const seen = new Set();
  return (Array.isArray(roles) ? roles : [])
    .map((role, index) => ({
      id: String(role?.id || `custom:role-${index + 1}`),
      label: String(role?.label || '').trim().slice(0, 12),
      color: /^#[0-9a-f]{6}$/i.test(String(role?.color || ''))
        ? String(role.color)
        : ROLE_COLOR_PALETTE[index % ROLE_COLOR_PALETTE.length],
      custom: true,
    }))
    .filter(role =>
      role.label &&
      !BUILT_IN_ROLE_IDS.has(role.id) &&
      !seen.has(role.id) &&
      seen.add(role.id));
};

export const getRoleDefinitions = customRoles => [
  ...CARD_ROLES,
  ...normalizeCustomRoles(customRoles),
];

const getValidRoleIds = roleDefinitions => new Set(
  (roleDefinitions || CARD_ROLES).map(role => role.id),
);

export const normalizeRoleAssignments = (
  assignments,
  roleDefinitions = CARD_ROLES,
) => {
  const validRoleIds = getValidRoleIds(roleDefinitions);
  return Object.fromEntries(
    Object.entries(assignments || {})
      .map(([cardId, roles]) => [
        normalizeId(cardId),
        [...new Set(Array.isArray(roles) ? roles : [])]
          .filter(roleId => validRoleIds.has(roleId)),
      ])
      .filter(([, roles]) => roles.length),
  );
};

export const toggleRoleForCards = (
  assignments,
  cardIds,
  roleId,
  roleDefinitions = CARD_ROLES,
) => {
  const validRoleIds = getValidRoleIds(roleDefinitions);
  if (!validRoleIds.has(roleId)) {
    return normalizeRoleAssignments(assignments, roleDefinitions);
  }
  const next = normalizeRoleAssignments(assignments, roleDefinitions);
  const ids = [...new Set(cardIds.map(normalizeId))];
  const shouldRemove = ids.length > 0 && ids.every(id =>
    next[id]?.includes(roleId));
  ids.forEach(id => {
    const roles = new Set(next[id] || []);
    if (shouldRemove) {
      roles.delete(roleId);
    } else {
      roles.add(roleId);
    }
    if (roles.size) {
      next[id] = [...roles];
    } else {
      delete next[id];
    }
  });
  return next;
};

export const autoTagKnownHandTraps = (
  cardIds,
  assignments = {},
  roleDefinitions = CARD_ROLES,
) => {
  const next = normalizeRoleAssignments(assignments, roleDefinitions);
  const taggedIds = [];
  [...new Set(cardIds.map(normalizeId))].forEach(id => {
    if (!KNOWN_HAND_TRAPS.has(id) || next[id]?.includes('handtrap')) return;
    next[id] = [...(next[id] || []), 'handtrap'];
    taggedIds.push(id);
  });
  return {
    assignments: next,
    taggedIds,
  };
};

export const countRoleCopies = (
  cardIds,
  assignments,
  roleId,
  roleDefinitions = CARD_ROLES,
) => {
  const normalized = normalizeRoleAssignments(assignments, roleDefinitions);
  return cardIds.reduce((count, cardId) =>
    count + Number(Boolean(
      normalized[normalizeId(cardId)]?.includes(roleId),
    )), 0);
};

export const removeRole = (assignments, roleId, roleDefinitions) => {
  const next = normalizeRoleAssignments(assignments, roleDefinitions);
  Object.keys(next).forEach(cardId => {
    next[cardId] = next[cardId].filter(id => id !== roleId);
    if (!next[cardId].length) delete next[cardId];
  });
  return next;
};
