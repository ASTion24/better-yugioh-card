import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROJECT_FILE_VERSION,
  parseProject,
  parseWorkspace,
  serializeProject,
  serializeWorkspace,
} from '../project-store.js';

test('project files round-trip deck workspaces', () => {
  const project = {
    id: 'deck-1',
    kind: 'deck',
    name: '测试卡组',
    deck: {
      main: ['89631139', 'custom:card-1'],
      extra: [],
      side: [],
    },
    customCards: {
      'custom:card-1': {
        id: 'custom:card-1',
        name: '原创卡',
        cardKind: 'yugioh',
        data: { name: '原创卡', password: '00000001' },
      },
    },
    playtest: {
      roles: {
        89631139: ['starter'],
        'custom:card-1': ['extender', 'brick'],
      },
      autoTaggedCardIds: ['89631139'],
      customRoles: [{
        id: 'custom:one-card',
        label: '一卡动',
        color: '#123456',
      }],
      goals: [{
        id: 'goal-1',
        name: '初动+补点',
        mode: 'all',
        conditions: [
          { roleId: 'starter', comparator: 'atLeast', count: 1 },
        ],
      }],
      activeGoalId: 'goal-1',
      history: [{
        id: 'hand-1',
        mode: 'second',
        firstFive: ['89631139'],
        sixth: 'custom:card-1',
        verdict: 'hit',
        createdAt: '2026-09-07T00:00:00.000Z',
      }],
      analysis: {
        snapshots: [{
          id: 'snapshot-1',
          name: '比赛版',
          createdAt: '2026-09-07T00:00:00.000Z',
          deck: {
            main: ['89631139', 'custom:card-1'],
            extra: [],
            side: [],
          },
          roles: { 89631139: ['starter'] },
          customRoles: [],
          goals: [],
          activeGoalId: '',
        }],
        activeSnapshotId: 'snapshot-1',
        sidePlans: [{
          id: 'side-plan-1',
          name: '后攻',
          mode: 'second',
          swaps: [{
            outId: '89631139',
            outSection: 'main',
            inId: 'custom:card-1',
            count: 1,
          }],
        }],
        activeSidePlanId: 'side-plan-1',
        inventory: {
          enabled: true,
          counts: { 89631139: 2 },
        },
        metadata: {
          format: 'ocg',
          effectiveDate: '2026-09-01',
          event: '测试赛',
          tags: ['竞技'],
          notes: '后攻测试',
        },
      },
    },
  };
  const parsed = parseProject(serializeProject(project));
  assert.equal(parsed.kind, 'deck');
  assert.equal(parsed.name, '测试卡组');
  assert.deepEqual(parsed.deck.main, ['89631139', 'custom:card-1']);
  assert.equal(parsed.customCards['custom:card-1'].data.password, '00000001');
  assert.deepEqual(parsed.playtest.roles['89631139'], ['starter']);
  assert.deepEqual(
    parsed.playtest.roles['custom:card-1'],
    ['extender', 'brick'],
  );
  assert.deepEqual(parsed.playtest.autoTaggedCardIds, ['89631139']);
  assert.equal(parsed.playtest.customRoles[0].label, '一卡动');
  assert.equal(parsed.playtest.goals[0].conditions[0].roleId, 'starter');
  assert.equal(parsed.playtest.activeGoalId, 'goal-1');
  assert.equal(parsed.playtest.history[0].verdict, 'hit');
  assert.equal(parsed.playtest.analysis.snapshots[0].name, '比赛版');
  assert.equal(parsed.playtest.analysis.sidePlans[0].swaps[0].count, 1);
  assert.equal(parsed.playtest.analysis.inventory.counts['89631139'], 2);
  assert.equal(parsed.playtest.analysis.metadata.event, '测试赛');
  assert.equal(parsed.revision, 0);
  assert.notEqual(parsed.id, project.id);
});

test('project files migrate version 1 records and add current defaults', () => {
  const parsed = parseProject(JSON.stringify({
    format: 'yugioh-card-project',
    version: 1,
    project: {
      kind: 'deck',
      name: '旧版卡组',
      deck: { main: ['89631139'], extra: [], side: [] },
    },
  }));
  assert.equal(parsed.schemaVersion, PROJECT_FILE_VERSION);
  assert.deepEqual(parsed.selectedSections, {
    main: true,
    extra: true,
    side: true,
  });
  assert.deepEqual(parsed.customCards, {});
  assert.deepEqual(parsed.playtest, {
    roles: {},
    autoTaggedCardIds: [],
    customRoles: [],
    goals: [],
    activeGoalId: '',
    history: [],
    analysis: {
      snapshots: [],
      activeSnapshotId: '',
      sidePlans: [],
      activeSidePlanId: '',
      inventory: { enabled: false, counts: {} },
      metadata: {
        format: 'ocg',
        effectiveDate: '',
        event: '',
        tags: [],
        notes: '',
      },
      banlist: {
        format: 'ocg',
        effectiveDate: '',
        checkedAt: '',
        checkedCardIds: [],
        limits: {},
        names: {},
      },
      presets: [],
      activePresetId: '',
    },
  });
});

test('project files accept batch workspaces and reject unknown payloads', () => {
  const parsed = parseProject(serializeProject({
    id: 'batch-1',
    kind: 'batch',
    name: '批量项目',
    cards: [{ name: '原创卡' }],
  }));
  assert.equal(parsed.kind, 'batch');
  assert.equal(parsed.cards[0].name, '原创卡');
  assert.throws(() => parseProject(JSON.stringify({
    format: 'yugioh-card-project',
    version: 1,
    project: { kind: 'unknown' },
  })), /缺少可识别/);
  assert.throws(() => parseProject(JSON.stringify({
    format: 'yugioh-card-project',
    version: PROJECT_FILE_VERSION + 1,
    project: { kind: 'batch', cards: [] },
  })), /不是有效/);
});

test('project files preserve single-card template and renderer data', () => {
  const parsed = parseProject(serializeProject({
    id: 'card-1',
    kind: 'card',
    name: '单卡项目',
    cardKind: 'yugioh',
    data: {
      name: '原创卡',
      type: 'monster',
      cardType: 'effect',
    },
  }));
  assert.equal(parsed.kind, 'card');
  assert.equal(parsed.cardKind, 'yugioh');
  assert.equal(parsed.data.name, '原创卡');
});

test('workspace backups preserve project IDs and every workspace kind', () => {
  const projects = [
    {
      id: 'deck-1',
      kind: 'deck',
      name: '卡组',
      deck: { main: ['1'], extra: [], side: [] },
    },
    {
      id: 'batch-1',
      kind: 'batch',
      name: '批量',
      cards: [{ name: '原创卡' }],
    },
    {
      id: 'card-1',
      kind: 'card',
      name: '单卡',
      cardKind: 'yugioh',
      data: { name: '单卡' },
    },
  ];
  const parsed = parseWorkspace(serializeWorkspace(projects));
  assert.deepEqual(parsed.map(project => project.id), [
    'deck-1',
    'batch-1',
    'card-1',
  ]);
  assert.deepEqual(parsed.map(project => project.kind), [
    'deck',
    'batch',
    'card',
  ]);
});

test('workspace backups reject invalid payloads and project records', () => {
  assert.throws(
    () => parseWorkspace('{}'),
    /不是有效/,
  );
  assert.throws(
    () => parseWorkspace(JSON.stringify({
      format: 'yugioh-card-workspace',
      version: 1,
      projects: [{ kind: 'unknown' }],
    })),
    /第 1 个项目格式无效/,
  );
});
