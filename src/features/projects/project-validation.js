import {
  getCustomCard,
  getCustomCardDefaultSection,
  isCustomCardId,
} from '../cards/custom-card.js';
import { resolveCard } from '../cards/card-service.js';
import { flattenPrintQueue } from '../print/print-queue.js';
import { flattenDeck } from '../print/ydk.js';
import { runWithConcurrency } from '../print/concurrency.js';
import { inspectBanlist } from '../playtest/banlist.js';

const issue = (id, severity, title, detail, fix = null) => ({
  id,
  severity,
  title,
  detail,
  fix,
});

const expectedSection = (project, id, resolvedCards) => {
  const custom = getCustomCard(project.customCards, id);
  if (custom) return getCustomCardDefaultSection(custom);
  return resolvedCards.get(String(id))?.defaultSection || '';
};

export const inspectDeckProject = async (project, options = {}) => {
  const resolve = options.resolveCard || resolveCard;
  const deck = project?.deck || { main: [], extra: [], side: [] };
  const customCards = project?.customCards || {};
  const queue = project?.printQueue || [];
  const deckIds = flattenDeck(deck).map(String);
  const queueIds = flattenPrintQueue(queue).map(String);
  const issues = [];

  if (!deckIds.length) {
    issues.push(issue(
      'empty-deck',
      'error',
      '卡组为空',
      '没有可交付或打印的卡片。',
    ));
  }
  if (!queueIds.length) {
    issues.push(issue(
      'empty-print-queue',
      'error',
      '打印队列为空',
      '请从卡组重置打印队列。',
      { type: 'reset-print-queue' },
    ));
  }

  const mainCount = deck.main?.length || 0;
  const extraCount = deck.extra?.length || 0;
  const sideCount = deck.side?.length || 0;
  if (mainCount > 0 && (mainCount < 40 || mainCount > 60)) {
    issues.push(issue(
      'deck-size:main',
      'warning',
      '主卡组数量不符合标准构筑',
      `当前 ${mainCount} 张，标准范围为 40–60 张。`,
    ));
  }
  if (extraCount > 15) {
    issues.push(issue(
      'deck-size:extra',
      'warning',
      '额外卡组超过 15 张',
      `当前 ${extraCount} 张。`,
    ));
  }
  if (sideCount > 15) {
    issues.push(issue(
      'deck-size:side',
      'warning',
      '副卡组超过 15 张',
      `当前 ${sideCount} 张。`,
    ));
  }

  const usedIds = [...new Set([...deckIds, ...queueIds])];
  usedIds.filter(isCustomCardId).forEach(id => {
    const card = getCustomCard(customCards, id);
    if (!card) {
      issues.push(issue(
        `missing-custom:${id}`,
        'error',
        '原创卡数据缺失',
        id,
        { type: 'remove-card', id },
      ));
      return;
    }
    if (!String(card.name || card.data?.name || '').trim()) {
      issues.push(issue(
        `custom-name:${id}`,
        'warning',
        '原创卡缺少名称',
        id,
      ));
    }
    if (!String(card.data?.image || '').trim()) {
      issues.push(issue(
        `custom-image:${id}`,
        'warning',
        '原创卡缺少卡图',
        card.name || id,
      ));
    }
    const data = card.data || {};
    if (!['monster', 'pendulum', 'spell', 'trap'].includes(data.type)) {
      issues.push(issue(
        `custom-type:${id}`,
        'warning',
        '原创卡缺少有效卡片类别',
        card.name || id,
      ));
    }
    if (!String(data.description || '').trim()) {
      issues.push(issue(
        `custom-description:${id}`,
        'warning',
        '原创卡缺少效果文本',
        card.name || id,
      ));
    }
    if (data.cardType === 'link' &&
      (!Array.isArray(data.arrowList) || !data.arrowList.length)) {
      issues.push(issue(
        `custom-link:${id}`,
        'warning',
        '连接怪兽未设置连接箭头',
        card.name || id,
      ));
    }
  });

  const deckSet = new Set(deckIds);
  const detachedQueueIds = [...new Set(queueIds.filter(id => !deckSet.has(id)))];
  if (detachedQueueIds.length) {
    issues.push(issue(
      'detached-print-queue',
      'warning',
      '打印队列包含已不在卡组中的卡片',
      detachedQueueIds.join('、'),
      { type: 'reset-print-queue' },
    ));
  }

  const officialIds = usedIds.filter(id => !isCustomCardId(id));
  const resolvedCards = new Map();
  const resolveTasks = officialIds.map(id => async () => {
    try {
      resolvedCards.set(id, await resolve(id));
    } catch (error) {
      issues.push(issue(
        `unresolved:${id}`,
        'error',
        '卡号无法解析',
        `${id} · ${error instanceof Error ? error.message : String(error)}`,
        { type: 'remove-card', id },
      ));
    }
  });
  await runWithConcurrency(resolveTasks, 3);

  const copyCounts = new Map();
  deckIds.forEach(id => {
    copyCounts.set(id, (copyCounts.get(id) || 0) + 1);
  });
  [...copyCounts.entries()]
    .filter(([, count]) => count > 3)
    .forEach(([id, count]) => {
      issues.push(issue(
        `copy-limit:${id}`,
        'warning',
        '同名卡超过 3 张',
        `${
          getCustomCard(customCards, id)?.name ||
          resolvedCards.get(id)?.name ||
          id
        } · ${count} 张`,
      ));
    });

  const banlist = project?.playtest?.analysis?.banlist;
  if (banlist?.checkedAt) {
    inspectBanlist(deck, banlist).violations.forEach(item => {
      issues.push(issue(
        `banlist:${item.id}`,
        'error',
        item.limit === 0 ? '禁用卡投入' : '卡片超过禁限数量',
        `${item.name} · 当前 ${item.count} 张，允许 ${item.limit} 张`,
      ));
    });
  }

  ['main', 'extra'].forEach(section => {
    [...new Set((deck[section] || []).map(String))].forEach(id => {
      const expected = expectedSection(project, id, resolvedCards);
      if (expected && expected !== section) {
        issues.push(issue(
          `section:${section}:${id}`,
          'warning',
          section === 'main'
            ? '额外卡组卡片位于主卡组'
            : '主卡组卡片位于额外卡组',
          getCustomCard(customCards, id)?.name ||
            resolvedCards.get(id)?.name ||
            id,
          {
            type: 'move-section',
            id,
            from: section,
            to: expected,
          },
        ));
      }
    });
  });

  return issues.sort((first, second) => {
    const weight = { error: 0, warning: 1, info: 2 };
    return weight[first.severity] - weight[second.severity];
  });
};

export const serializeInspectionReport = (project, issues) => {
  const counts = issues.reduce((result, item) => {
    result[item.severity] = (result[item.severity] || 0) + 1;
    return result;
  }, {});
  return [
    `卡组：${project?.name || '未命名卡组'}`,
    `检查时间：${new Date().toISOString()}`,
    `结果：${counts.error || 0} 个错误，${counts.warning || 0} 个警告`,
    '',
    ...issues.map(item =>
      `[${item.severity.toUpperCase()}] ${item.title}\n${item.detail}`),
  ].join('\n');
};
