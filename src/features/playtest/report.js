const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const percent = value => `${(Number(value || 0) * 100).toFixed(1)}%`;

const sectionRows = (title, items) => {
  const rows = items.length
    ? items.map(item => `<tr>${item.map(value =>
      `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')
    : '<tr><td colspan="6">暂无数据</td></tr>';
  return `<section><h2>${escapeHtml(title)}</h2><table><tbody>${rows}</tbody></table></section>`;
};

export const createAnalysisReportHtml = data => {
  const metadata = data.metadata || {};
  const deckRows = ['main', 'extra', 'side'].flatMap(section => {
    const counts = new Map();
    (data.deck?.[section] || []).forEach(cardId => {
      const id = String(cardId);
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return [...counts].map(([id, count]) => [
      { main: '主卡组', extra: '额外卡组', side: '副卡组' }[section],
      data.cardNames?.[id] || id,
      id,
      count,
    ]);
  });
  const roleRows = (data.roleStats || []).map(stat => [
    stat.role.label,
    `${stat.copies} / ${data.deckSize}`,
    percent(stat.firstFive),
    `${percent(stat.goingSecond)} (${percent(stat.firstFive)} + ${percent(stat.sixthOnly)})`,
  ]);
  const goalRows = (data.goalStats || []).map(stat => [
    stat.name,
    stat.mode === 'any' ? '任一满足' : '全部满足',
    percent(stat.firstFive),
    `${percent(stat.goingSecond)} (${percent(stat.firstFive)} + ${percent(stat.sixthDelta)})`,
  ]);
  const diagnosisRows = (data.diagnostics?.reasons || []).map(reason => [
    reason.label,
    reason.count,
    data.diagnostics.failedHands
      ? percent(reason.count / data.diagnostics.failedHands)
      : '0.0%',
  ]);
  const missingRows = (data.missingCards || []).map(card => [
    data.cardNames?.[card.id] || card.id,
    card.required,
    card.owned,
    card.missing,
  ]);
  const sideRows = (data.sidePlans || []).map(plan => [
    plan.name,
    plan.mode === 'first' ? '先攻' : '后攻',
    `${plan.swaps.length} 组`,
    plan.note || '',
  ]);
  const snapshotRows = (data.snapshots || []).map(snapshot => [
    snapshot.name,
    snapshot.deck.main.length,
    snapshot.deck.extra.length,
    snapshot.deck.side.length,
    snapshot.createdAt
      ? new Date(snapshot.createdAt).toLocaleString('zh-CN')
      : '',
  ]);
  const violationRows = (data.banlistResult?.violations || []).map(item => [
    data.cardNames?.[item.id] || item.name || item.id,
    item.count,
    item.limit,
  ]);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.projectName || '卡组分析报告')}</title>
<style>
  :root { color-scheme: light; font-family: "PingFang SC", "Hiragino Sans GB", sans-serif; color: #1c1d1b; background: #f2f0ea; }
  body { max-width: 960px; margin: 0 auto; padding: 40px; background: #fffefa; }
  header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #1c1d1b; }
  h1, h2, p { margin: 0; } h1 { font-family: "Songti SC", serif; font-size: 30px; }
  header p, small { color: #74736e; } section { margin-top: 28px; }
  h2 { margin-bottom: 10px; font-family: "Songti SC", serif; font-size: 18px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin-top: 18px; background: #d7d3ca; }
  .meta span { padding: 12px; background: #f8f7f3; } .meta b { display: block; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 9px 10px; border: 1px solid #d7d3ca; vertical-align: top; }
  .notes { white-space: pre-wrap; line-height: 1.7; }
  @media print { body { max-width: none; padding: 0; } }
</style>
</head>
<body>
<header><div><small>BETTER YGO · ANALYSIS REPORT</small><h1>${escapeHtml(data.projectName || '未命名卡组')}</h1></div><p>${escapeHtml(new Date().toLocaleString('zh-CN'))}</p></header>
<div class="meta">
  <span>赛制<b>${escapeHtml(metadata.format || 'ocg').toUpperCase()}</b></span>
  <span>日期<b>${escapeHtml(metadata.effectiveDate || '未设置')}</b></span>
  <span>赛事<b>${escapeHtml(metadata.event || '未设置')}</b></span>
  <span>构筑<b>${data.deckSize || 0} / ${data.extraCount || 0} / ${data.sideCount || 0}</b></span>
</div>
${sectionRows('当前构筑', deckRows)}
${sectionRows('角色概率', roleRows)}
${sectionRows('组合目标', goalRows)}
${sectionRows('失败诊断', diagnosisRows)}
${sectionRows('换备方案', sideRows)}
${sectionRows('构筑快照', snapshotRows)}
${sectionRows('禁限检查', violationRows)}
${sectionRows('缺卡清单', missingRows)}
<section><h2>标签与备注</h2><p>${escapeHtml((metadata.tags || []).join(' · ') || '无标签')}</p><p class="notes">${escapeHtml(metadata.notes || '暂无备注')}</p></section>
</body>
</html>`;
};
