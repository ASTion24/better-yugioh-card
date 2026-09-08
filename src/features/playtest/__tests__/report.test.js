import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalysisReportHtml } from '../report.js';

test('analysis report is self-contained, printable and escapes project text', () => {
  const report = createAnalysisReportHtml({
    projectName: '<测试卡组>',
    metadata: {
      format: 'ocg',
      event: '本地赛',
      tags: ['竞技'],
      notes: '<script>alert(1)</script>',
    },
    deckSize: 40,
    extraCount: 15,
    sideCount: 15,
    roleStats: [],
    goalStats: [],
    diagnostics: { failedHands: 0, reasons: [] },
    missingCards: [],
    banlistResult: { violations: [] },
    sidePlans: [],
    snapshots: [],
  });
  assert.match(report, /<!doctype html>/);
  assert.match(report, /@media print/);
  assert.match(report, /&lt;测试卡组&gt;/);
  assert.doesNotMatch(report, /<script>alert/);
});
