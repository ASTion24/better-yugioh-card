import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectDeckProject,
  serializeInspectionReport,
} from '../project-validation.js';

test('deck inspection reports missing records, queue drift and section errors', async () => {
  const issues = await inspectDeckProject({
    name: '待检查卡组',
    deck: {
      main: ['100', 'custom:missing'],
      extra: ['200'],
      side: [],
    },
    customCards: {},
    printQueue: [
      { id: '100', count: 1 },
      { id: '300', count: 1 },
    ],
  }, {
    resolveCard: async id => ({
      id,
      name: `卡片 ${id}`,
      defaultSection: id === '100' ? 'extra' : 'main',
    }),
  });

  assert.ok(issues.some(item => item.id === 'missing-custom:custom:missing'));
  assert.ok(issues.some(item => item.id === 'detached-print-queue'));
  assert.ok(issues.some(item => item.id === 'section:main:100'));
  assert.ok(issues.some(item => item.id === 'section:extra:200'));
});

test('inspection report summarizes issue severity', () => {
  const report = serializeInspectionReport(
    { name: '测试卡组' },
    [
      { severity: 'error', title: '错误', detail: '详情' },
      { severity: 'warning', title: '警告', detail: '详情' },
    ],
  );
  assert.match(report, /测试卡组/);
  assert.match(report, /1 个错误，1 个警告/);
});

test('deck inspection reports static size, copy and custom-card rules', async () => {
  const project = {
    deck: {
      main: ['1', '1', '1', '1'],
      extra: Array.from({ length: 16 }, () => '2'),
      side: Array.from({ length: 16 }, () => '3'),
    },
    customCards: {
      'custom:link': {
        id: 'custom:link',
        name: '未完成连接怪兽',
        data: {
          name: '未完成连接怪兽',
          type: 'monster',
          cardType: 'link',
          description: '',
          image: '',
          arrowList: [],
        },
      },
    },
    printQueue: [{ id: '1', count: 4 }],
    playtest: {
      analysis: {
        banlist: {
          checkedAt: '2026-09-07T00:00:00.000Z',
          checkedCardIds: ['1'],
          limits: { 1: 1 },
          names: { 1: '限制测试卡' },
        },
      },
    },
  };
  project.deck.main.push('custom:link');
  const issues = await inspectDeckProject(project, {
    resolveCard: async id => ({
      id,
      name: `卡片 ${id}`,
      defaultSection: 'main',
    }),
  });

  assert.ok(issues.some(item => item.id === 'deck-size:main'));
  assert.ok(issues.some(item => item.id === 'deck-size:extra'));
  assert.ok(issues.some(item => item.id === 'deck-size:side'));
  assert.ok(issues.some(item => item.id === 'copy-limit:1'));
  assert.ok(issues.some(item => item.id === 'custom-description:custom:link'));
  assert.ok(issues.some(item => item.id === 'custom-link:custom:link'));
  assert.ok(issues.some(item => item.id === 'banlist:1'));
});
