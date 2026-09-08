import { normalizeAnalysis } from '../playtest/analysis.js';

const DATABASE_NAME = 'yugioh-card-workspace';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';
const ACTIVE_PROJECT_KEY = 'yugioh-card-active-project';
const PROJECT_CHANNEL_NAME = 'yugioh-card-project-events';
const PROJECT_SOURCE_ID = globalThis.crypto?.randomUUID?.() ||
  `source-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export const PROJECT_FILE_VERSION = 3;
export const WORKSPACE_FILE_VERSION = 1;
const projectKind = project => project?.kind || 'deck';
const activeProjectKey = kind => `${ACTIVE_PROJECT_KEY}:${kind}`;
let projectChannel;
const DEFAULT_PROJECT_NAMES = {
  batch: '未命名批量制卡方案',
  card: '未命名单卡',
  deck: '未命名卡组',
};

const openDatabase = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('当前浏览器不支持本地内容库'));
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PROJECT_STORE)) {
      const store = database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('无法打开本地内容库'));
});

const runRequest = async (mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, mode);
    const store = transaction.objectStore(PROJECT_STORE);
    const request = operation(store);
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error('本地内容操作失败'));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('本地内容写入失败'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('本地内容操作已中止'));
    };
  });
};

const getProjectChannel = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  projectChannel ||= new BroadcastChannel(PROJECT_CHANNEL_NAME);
  return projectChannel;
};

const publishProjectChange = change => {
  getProjectChannel()?.postMessage({
    ...change,
    sourceId: PROJECT_SOURCE_ID,
    timestamp: Date.now(),
  });
};

export const subscribeProjectChanges = listener => {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(PROJECT_CHANNEL_NAME);
  const onMessage = event => {
    if (event.data?.sourceId !== PROJECT_SOURCE_ID) {
      listener(event.data);
    }
  };
  channel.addEventListener('message', onMessage);
  return () => {
    channel.removeEventListener('message', onMessage);
    channel.close();
  };
};

export class ProjectConflictError extends Error {
  constructor(projectId) {
    super('当前内容已在其他标签页更新，请重新载入后继续编辑');
    this.name = 'ProjectConflictError';
    this.projectId = projectId;
  }
}

export const isProjectConflictError = error =>
  error instanceof ProjectConflictError;

export const createProjectId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const normalizeProject = project => {
  const kind = projectKind(project);
  const normalized = {
    ...project,
    kind,
    revision: Math.max(0, Math.trunc(Number(project?.revision) || 0)),
    schemaVersion: PROJECT_FILE_VERSION,
  };
  if (kind === 'deck') {
    normalized.deck = {
      main: [...(project?.deck?.main || [])],
      extra: [...(project?.deck?.extra || [])],
      side: [...(project?.deck?.side || [])],
    };
    normalized.customCards = project?.customCards || {};
    normalized.settings = project?.settings || {};
    normalized.selectedSections = project?.selectedSections || {
      main: true,
      extra: true,
      side: true,
    };
    normalized.playtest = {
      roles: Object.fromEntries(
        Object.entries(project?.playtest?.roles || {})
          .map(([cardId, roles]) => [
            String(cardId),
            [...(Array.isArray(roles) ? roles : [])],
          ]),
      ),
      autoTaggedCardIds: [
        ...(project?.playtest?.autoTaggedCardIds || []),
      ].map(String),
      customRoles: (
        Array.isArray(project?.playtest?.customRoles)
          ? project.playtest.customRoles
          : []
      ).map(role => ({
        id: String(role?.id || ''),
        label: String(role?.label || ''),
        color: String(role?.color || ''),
      })),
      goals: (
        Array.isArray(project?.playtest?.goals)
          ? project.playtest.goals
          : []
      ).map(goal => ({
        id: String(goal?.id || ''),
        name: String(goal?.name || ''),
        mode: goal?.mode === 'any' ? 'any' : 'all',
        conditions: (goal?.conditions || []).map(condition => ({
          roleId: String(condition?.roleId || ''),
          comparator: condition?.comparator === 'atMost'
            ? 'atMost'
            : 'atLeast',
          count: Number(condition?.count) || 0,
        })),
      })),
      activeGoalId: String(project?.playtest?.activeGoalId || ''),
      history: (
        Array.isArray(project?.playtest?.history)
          ? project.playtest.history
          : []
      ).slice(-60).map(entry => ({
        id: String(entry?.id || ''),
        mode: entry?.mode === 'second' ? 'second' : 'first',
        firstFive: (entry?.firstFive || []).map(String).slice(0, 5),
        sixth: String(entry?.sixth || ''),
        verdict: ['hit', 'brick'].includes(entry?.verdict)
          ? entry.verdict
          : '',
        createdAt: String(entry?.createdAt || ''),
      })),
      analysis: normalizeAnalysis(project?.playtest?.analysis),
    };
  } else if (kind === 'batch') {
    normalized.cards = [...(project?.cards || [])];
  } else if (kind === 'card') {
    normalized.cardKind = project?.cardKind || 'yugioh';
    normalized.data = project?.data || {};
    normalized.sourceCardId = String(project?.sourceCardId || '');
  }
  return normalized;
};

const isValidProject = project => {
  const validDeck = project?.kind === 'deck' &&
    Array.isArray(project?.deck?.main) &&
    Array.isArray(project?.deck?.extra) &&
    Array.isArray(project?.deck?.side);
  const validBatch = project?.kind === 'batch' &&
    Array.isArray(project.cards);
  const validCard = project?.kind === 'card' &&
    typeof project.cardKind === 'string' &&
    project.data &&
    typeof project.data === 'object';
  return validDeck || validBatch || validCard;
};

export const listProjects = async kind => {
  const projects = await runRequest('readonly', store => store.getAll());
  return projects
    .map(normalizeProject)
    .filter(project => !kind || projectKind(project) === kind)
    .sort((first, second) =>
      String(second.updatedAt).localeCompare(String(first.updatedAt)));
};

export const getProject = async id => {
  const project = await runRequest('readonly', store => store.get(id));
  return project ? normalizeProject(project) : undefined;
};

export const saveProject = async project => {
  const now = new Date().toISOString();
  const defaultName = DEFAULT_PROJECT_NAMES[projectKind(project)] ||
    DEFAULT_PROJECT_NAMES.deck;
  const id = project.id || createProjectId();
  const database = await openDatabase();
  let record;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECT_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const existing = request.result;
      const existingRevision = Math.max(
        0,
        Math.trunc(Number(existing?.revision) || 0),
      );
      const hasExpectedRevision = project.revision !== undefined &&
        project.revision !== null;
      if (existing && hasExpectedRevision &&
        Math.max(0, Math.trunc(Number(project.revision) || 0)) !==
          existingRevision) {
        transaction.abort();
        reject(new ProjectConflictError(id));
        return;
      }
      record = {
        ...normalizeProject(project),
        id,
        revision: existingRevision + 1,
        name: String(project.name || defaultName).trim() || defaultName,
        createdAt: project.createdAt || existing?.createdAt || now,
        updatedAt: now,
      };
      store.put(record);
    };
    request.onerror = () => reject(
      request.error || new Error('无法读取本地内容'),
    );
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(
      transaction.error || new Error('本地内容写入失败'),
    );
    transaction.onabort = () => {
      if (transaction.error) reject(transaction.error);
    };
  }).finally(() => database.close());
  publishProjectChange({
    type: 'saved',
    id: record.id,
    kind: record.kind,
    revision: record.revision,
  });
  return record;
};

export const duplicateProject = project => saveProject({
  ...normalizeProject(project),
  id: '',
  revision: 0,
  name: `${String(project?.name || '未命名内容').trim()} 副本`,
  createdAt: '',
  updatedAt: '',
});

export const deleteProject = async id => {
  await runRequest('readwrite', store => store.delete(id));
  publishProjectChange({ type: 'deleted', id: String(id) });
};

export const getActiveProjectId = (kind = 'deck') => {
  try {
    return localStorage.getItem(activeProjectKey(kind)) ||
      (kind === 'deck' ? localStorage.getItem(ACTIVE_PROJECT_KEY) : '') ||
      '';
  } catch {
    return '';
  }
};

export const setActiveProjectId = (id, kind = 'deck') => {
  try {
    if (kind === 'deck') {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
    if (id) {
      localStorage.setItem(activeProjectKey(kind), id);
    } else {
      localStorage.removeItem(activeProjectKey(kind));
    }
  } catch {
    // The in-memory project remains usable when storage is unavailable.
  }
};

export const serializeProject = project => JSON.stringify({
  format: 'yugioh-card-project',
  version: PROJECT_FILE_VERSION,
  project: normalizeProject(project),
}, null, 2);

export const parseProject = value => {
  const payload = JSON.parse(value);
  if (payload?.format !== 'yugioh-card-project' ||
    ![1, 2, PROJECT_FILE_VERSION].includes(payload.version)) {
    throw new Error('不是有效的 Better YGO 备份文件');
  }
  if (!payload.project || typeof payload.project !== 'object') {
    throw new Error('备份文件缺少可识别的数据');
  }
  const project = normalizeProject(payload.project);
  if (!isValidProject(project)) {
    throw new Error('备份文件缺少可识别的数据');
  }
  return {
    ...project,
    id: createProjectId(),
    revision: 0,
    createdAt: '',
    updatedAt: '',
  };
};

export const serializeWorkspace = projects => JSON.stringify({
  format: 'yugioh-card-workspace',
  version: WORKSPACE_FILE_VERSION,
  projectVersion: PROJECT_FILE_VERSION,
  exportedAt: new Date().toISOString(),
  projects: projects.map(normalizeProject),
}, null, 2);

export const parseWorkspace = value => {
  const payload = JSON.parse(value);
  if (payload?.format !== 'yugioh-card-workspace' ||
    payload.version !== WORKSPACE_FILE_VERSION ||
    !Array.isArray(payload.projects)) {
    throw new Error('不是有效的 Better YGO 工作区备份');
  }
  if (payload.projects.length > 1000) {
    throw new Error('工作区备份最多包含 1000 条内容');
  }
  const projects = payload.projects.map((project, index) => {
    if (!project || typeof project !== 'object') {
      throw new Error(`工作区中的第 ${index + 1} 条记录格式无效`);
    }
    const normalized = normalizeProject(project);
    if (!isValidProject(normalized)) {
      throw new Error(`工作区中的第 ${index + 1} 条记录格式无效`);
    }
    return {
      ...normalized,
      id: String(project.id || createProjectId()),
      createdAt: project.createdAt || '',
      updatedAt: project.updatedAt || '',
    };
  });
  return projects;
};

export const restoreWorkspace = async (value, options = {}) => {
  const projects = parseWorkspace(value)
    .filter(project => !options.kind || projectKind(project) === options.kind);
  const database = await openDatabase();
  const now = new Date().toISOString();
  const records = projects.map(project => ({
    ...project,
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || now,
  }));
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECT_STORE);
    records.forEach(project => store.put(project));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(
      transaction.error || new Error('工作区恢复失败'),
    );
    transaction.onabort = () => reject(
      transaction.error || new Error('工作区恢复已中止'),
    );
  }).finally(() => database.close());
  records.forEach(project => publishProjectChange({
    type: 'saved',
    id: project.id,
    kind: project.kind,
    revision: project.revision,
  }));
  return records;
};
