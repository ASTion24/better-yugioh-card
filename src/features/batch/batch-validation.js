const blank = value => !String(value ?? '').trim();

const issue = (severity, field, message) => ({
  severity,
  field,
  message,
});

const MONSTER_CARD_TYPES = new Set([
  'normal',
  'effect',
  'ritual',
  'fusion',
  'synchro',
  'xyz',
  'link',
  'token',
]);

const validStat = value => Number.isFinite(Number(value));

export const validateBatchCard = (card, cards = []) => {
  const issues = [];
  const isMonster = ['monster', 'pendulum'].includes(card?.type);

  if (blank(card?.name)) {
    issues.push(issue('error', 'name', '缺少卡片名称'));
  } else if (/^未命名卡片(?:\s|$)/.test(card.name)) {
    issues.push(issue('warning', 'name', '仍在使用默认卡名'));
  }

  if (blank(card?.image)) {
    issues.push(issue('error', 'image', '缺少卡图'));
  }

  if (card?.password && !/^\d{8}$/.test(String(card.password))) {
    issues.push(issue('warning', 'password', '卡片密码不是八位数字'));
  }

  if (card?.password) {
    const password = String(card.password);
    const duplicate = cards.some(candidate =>
      candidate !== card &&
      String(candidate?.password || '') === password);
    if (duplicate) {
      issues.push(issue('warning', 'password', '卡片密码与批次内其他卡片重复'));
    }
  }

  if (!['monster', 'pendulum', 'spell', 'trap'].includes(card?.type)) {
    issues.push(issue('error', 'type', '卡片类别无效'));
  }

  if (isMonster) {
    if (!MONSTER_CARD_TYPES.has(card?.cardType)) {
      issues.push(issue('error', 'cardType', '怪兽类型无效'));
    }
    if (blank(card?.monsterType)) {
      issues.push(issue('warning', 'monsterType', '缺少种族或分类'));
    }
    if (!validStat(card?.atk)) {
      issues.push(issue('error', 'atk', 'ATK 不是有效数字'));
    }
    if (card?.cardType !== 'link' && !validStat(card?.def)) {
      issues.push(issue('error', 'def', 'DEF 不是有效数字'));
    }
    if (card?.cardType !== 'link') {
      const level = card?.cardType === 'xyz' ? card?.rank : card?.level;
      if (!validStat(level) || Number(level) < 0 || Number(level) > 13) {
        issues.push(issue(
          'error',
          card?.cardType === 'xyz' ? 'rank' : 'level',
          '等级或阶级必须在 0 至 13 之间',
        ));
      }
    }
    if (card?.cardType === 'link' &&
      (!Array.isArray(card.arrowList) || !card.arrowList.length)) {
      issues.push(issue('warning', 'arrowList', '连接怪兽尚未设置连接标记'));
    }
  }

  if (card?.type === 'pendulum' && blank(card?.pendulumDescription)) {
    issues.push(issue('warning', 'pendulumDescription', '灵摆效果为空'));
  }
  if (blank(card?.description)) {
    issues.push(issue('warning', 'description', '效果文本为空'));
  }

  return issues;
};

export const getBatchCardQuality = (card, cards = []) => {
  const issues = validateBatchCard(card, cards);
  const errors = issues.filter(item => item.severity === 'error').length;
  const warnings = issues.length - errors;
  return {
    issues,
    errors,
    warnings,
    status: errors ? 'blocked' : warnings ? 'attention' : 'ready',
  };
};

export const auditBatchCards = cards => {
  const items = (Array.isArray(cards) ? cards : []).map(card => ({
    batchId: card.batchId,
    ...getBatchCardQuality(card, cards),
  }));
  return {
    items,
    ready: items.filter(item => item.status === 'ready').length,
    attention: items.filter(item => item.status === 'attention').length,
    blocked: items.filter(item => item.status === 'blocked').length,
    issues: items.reduce((sum, item) => sum + item.issues.length, 0),
  };
};
