<template>
  <section class="analysis-panel">
    <div class="section-heading">
      <span>03</span>
      <h2>构筑迭代</h2>
      <button type="button" title="导出分析报告" @click="exportReport">
        <Icon icon="ri:file-chart-line" />
        <span>分析报告</span>
      </button>
    </div>

    <div class="analysis-grid">
      <section class="analysis-tool">
        <header>
          <div>
            <small>VERSION</small>
            <h3>构筑快照</h3>
          </div>
          <strong>{{ state.snapshots.length }} / 20</strong>
        </header>
        <form class="compact-create" @submit.prevent="addSnapshot">
          <input
            v-model="snapshotName"
            type="text"
            maxlength="32"
            aria-label="构筑快照名称"
            placeholder="例如：比赛前定稿"
          >
          <button type="submit" title="保存当前构筑快照">
            <Icon icon="ri:camera-line" />
          </button>
        </form>
        <div v-if="state.snapshots.length" class="tool-select-row">
          <select
            :value="state.activeSnapshotId"
            aria-label="选择构筑快照"
            @change="selectSnapshot($event.target.value)"
          >
            <option
              v-for="snapshot in state.snapshots"
              :key="snapshot.id"
              :value="snapshot.id"
            >
              {{ snapshot.name }}
            </option>
          </select>
          <button type="button" title="恢复所选快照" @click="restoreSnapshot">
            <Icon icon="ri:history-line" />
          </button>
          <button type="button" title="删除所选快照" @click="deleteSnapshot">
            <Icon icon="ri:delete-bin-line" />
          </button>
        </div>
        <div v-if="activeSnapshot" class="snapshot-comparison">
          <span>
            <small>主卡变化</small>
            <strong>{{ diffCount(snapshotDiff.main) }}</strong>
          </span>
          <span>
            <small>额外变化</small>
            <strong>{{ diffCount(snapshotDiff.extra) }}</strong>
          </span>
          <span>
            <small>Side 变化</small>
            <strong>{{ diffCount(snapshotDiff.side) }}</strong>
          </span>
          <span>
            <small>目标概率</small>
            <strong :class="{ negative: snapshotGoalDelta < 0 }">
              {{ signedPercent(snapshotGoalDelta) }}
            </strong>
          </span>
        </div>
        <p v-if="activeSnapshot && snapshotChangeText" class="tool-note">
          {{ snapshotChangeText }}
        </p>
        <div v-if="snapshotRoleDeltas.length" class="snapshot-role-deltas">
          <span v-for="item in snapshotRoleDeltas" :key="item.role.id">
            <i :style="{ background: item.role.color }" />
            {{ item.role.label }}
            <b :class="{ negative: item.delta < 0 }">
              {{ signedPercent(item.delta) }}
            </b>
          </span>
        </div>
        <div class="preset-row">
          <input
            v-model="presetName"
            type="text"
            maxlength="32"
            aria-label="分析配置名称"
            placeholder="保存角色与目标配置"
          >
          <button type="button" title="保存分析配置" @click="addPreset">
            <Icon icon="ri:bookmark-line" />
          </button>
          <select
            :value="state.activePresetId"
            aria-label="选择分析配置"
            @change="selectPreset($event.target.value)"
          >
            <option value="">分析配置</option>
            <option
              v-for="preset in state.presets"
              :key="preset.id"
              :value="preset.id"
            >
              {{ preset.name }}
            </option>
          </select>
          <button
            type="button"
            title="应用分析配置"
            :disabled="!activePreset"
            @click="applyPreset"
          >
            <Icon icon="ri:play-list-add-line" />
          </button>
          <button
            type="button"
            title="删除分析配置"
            :disabled="!activePreset"
            @click="deletePreset"
          >
            <Icon icon="ri:close-line" />
          </button>
        </div>
        <div class="preset-transfer">
          <button
            type="button"
            :disabled="!activePreset"
            @click="exportPreset"
          >
            <Icon icon="ri:download-2-line" />
            <span>导出配置</span>
          </button>
          <button type="button" @click="presetFileInput?.click()">
            <Icon icon="ri:folder-open-line" />
            <span>导入配置</span>
          </button>
          <input
            ref="presetFileInput"
            class="visually-hidden"
            type="file"
            accept=".ygoanalysis,.json,application/json"
            @change="importPreset"
          >
        </div>
      </section>

      <section class="analysis-tool side-tool">
        <header>
          <div>
            <small>MATCHUP</small>
            <h3>Side 换备</h3>
          </div>
          <button type="button" title="新增换备方案" @click="addSidePlan">
            <Icon icon="ri:add-line" />
          </button>
        </header>
        <div v-if="state.sidePlans.length" class="tool-select-row">
          <select
            :value="state.activeSidePlanId"
            aria-label="选择换备方案"
            @change="selectSidePlan($event.target.value)"
          >
            <option
              v-for="plan in state.sidePlans"
              :key="plan.id"
              :value="plan.id"
            >
              {{ plan.name }}
            </option>
          </select>
          <button type="button" title="应用换备方案" @click="applyActiveSidePlan">
            <Icon icon="ri:swap-2-line" />
          </button>
          <button type="button" title="删除换备方案" @click="deleteSidePlan">
            <Icon icon="ri:delete-bin-line" />
          </button>
        </div>
        <template v-if="activeSidePlan">
          <div class="side-plan-meta">
            <input
              :value="activeSidePlan.name"
              type="text"
              maxlength="32"
              aria-label="换备方案名称"
              @input="updateSidePlan({ name: $event.target.value })"
            >
            <div class="side-mode">
              <button
                type="button"
                :class="{ active: activeSidePlan.mode === 'first' }"
                @click="updateSidePlan({ mode: 'first' })"
              >
                先攻
              </button>
              <button
                type="button"
                :class="{ active: activeSidePlan.mode === 'second' }"
                @click="updateSidePlan({ mode: 'second' })"
              >
                后攻
              </button>
            </div>
          </div>
          <div class="side-swap-list">
            <div
              v-for="(swap, index) in activeSidePlan.swaps"
              :key="`${activeSidePlan.id}-${index}`"
              class="side-swap-row"
            >
              <select
                :value="`${swap.outSection}:${swap.outId}`"
                :aria-label="`换备 ${index + 1} 换出卡片`"
                @change="updateSwapSource(index, $event.target.value)"
              >
                <option
                  v-for="card in mainExtraOptions"
                  :key="`${card.section}:${card.id}`"
                  :value="`${card.section}:${card.id}`"
                >
                  出 · {{ card.name }} ×{{ card.count }}
                </option>
              </select>
              <Icon icon="ri:arrow-left-right-line" />
              <select
                :value="swap.inId"
                :aria-label="`换备 ${index + 1} 换入卡片`"
                @change="updateSwap(index, { inId: $event.target.value })"
              >
                <option
                  v-for="card in sideOptions"
                  :key="card.id"
                  :value="card.id"
                >
                  入 · {{ card.name }} ×{{ card.count }}
                </option>
              </select>
              <input
                :value="swap.count"
                type="number"
                min="1"
                max="3"
                :aria-label="`换备 ${index + 1} 数量`"
                @input="updateSwap(index, { count: Number($event.target.value) })"
              >
              <button type="button" title="删除交换项" @click="removeSwap(index)">
                <Icon icon="ri:close-line" />
              </button>
            </div>
          </div>
          <button
            class="inline-command"
            type="button"
            :disabled="!mainExtraOptions.length || !sideOptions.length"
            @click="addSwap"
          >
            <Icon icon="ri:add-line" />
            <span>添加交换</span>
          </button>
          <textarea
            :value="activeSidePlan.note"
            rows="2"
            maxlength="240"
            aria-label="换备方案备注"
            placeholder="对局要点"
            @input="updateSidePlan({ note: $event.target.value })"
          />
          <div class="side-result">
            <span>
              <small>交换</small>
              <strong>{{ sideSwapCount }} 张</strong>
            </span>
            <span>
              <small>目标概率</small>
              <strong>{{ percent(sideGoalProbability.goingSecond) }}</strong>
            </span>
            <span>
              <small>较当前</small>
              <strong :class="{ negative: sideGoalDelta < 0 }">
                {{ signedPercent(sideGoalDelta) }}
              </strong>
            </span>
          </div>
          <p v-if="sidePlanErrors.length" class="tool-error">
            {{ sidePlanErrors[0] }}
          </p>
        </template>
        <p v-else class="tool-empty">尚未创建换备方案</p>
      </section>
    </div>

    <section class="project-profile">
      <header>
        <div>
          <small>PROJECT PROFILE</small>
          <h3>赛制、库存与交付</h3>
        </div>
      </header>
      <div class="profile-fields">
        <label>
          <span>赛制</span>
          <select
            :value="state.metadata.format"
            @change="updateFormat($event.target.value)"
          >
            <option value="ocg">OCG</option>
            <option value="tcg">TCG</option>
            <option value="master-duel">Master Duel</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label>
          <span>日期</span>
          <input
            :value="state.metadata.effectiveDate"
            type="date"
            @input="updateMetadata('effectiveDate', $event.target.value)"
          >
        </label>
        <label>
          <span>赛事</span>
          <input
            :value="state.metadata.event"
            type="text"
            maxlength="40"
            placeholder="赛事或环境"
            @input="updateMetadata('event', $event.target.value)"
          >
        </label>
        <label>
          <span>标签</span>
          <input
            :value="state.metadata.tags.join(', ')"
            type="text"
            placeholder="竞技, 测试"
            @change="updateTags($event.target.value)"
          >
        </label>
      </div>
      <textarea
        :value="state.metadata.notes"
        class="project-notes"
        rows="3"
        maxlength="1000"
        aria-label="卡组备注"
        placeholder="构筑思路与对局记录"
        @input="updateMetadata('notes', $event.target.value)"
      />

      <div class="profile-columns">
        <details open>
          <summary>
            <span>禁限检查</span>
            <strong :class="{ error: banlistResult.violations.length }">
              {{ banlistResult.violations.length }} 项违规
            </strong>
          </summary>
          <div class="banlist-toolbar">
            <button
              type="button"
              :disabled="checkingBanlist"
              @click="refreshBanlist"
            >
              <Icon :icon="checkingBanlist ? 'ri:loader-4-line' : 'ri:refresh-line'" :class="{ spinning: checkingBanlist }" />
              <span>{{ checkingBanlist ? '检查中' : '同步当前表' }}</span>
            </button>
            <span>{{ state.banlist.checkedAt ? state.banlist.effectiveDate : '尚未检查' }}</span>
          </div>
          <textarea
            v-if="['master-duel', 'custom'].includes(state.metadata.format)"
            v-model="manualRules"
            rows="3"
            aria-label="自定义禁限卡表"
            placeholder="卡号=0（禁止）&#10;卡号=1（限制）"
          />
          <button
            v-if="['master-duel', 'custom'].includes(state.metadata.format)"
            class="inline-command"
            type="button"
            @click="applyManualBanlist"
          >
            <Icon icon="ri:check-line" />
            <span>应用手动表</span>
          </button>
          <div v-if="banlistResult.violations.length" class="compact-list error-list">
            <span v-for="item in banlistResult.violations" :key="item.id">
              <b>{{ cardName(item.id) }}</b>
              <small>{{ item.count }} / {{ item.limit }}</small>
            </span>
          </div>
          <p v-else class="tool-note">
            已检查 {{ banlistResult.checkedCount }} 种卡片
          </p>
        </details>

        <details>
          <summary>
            <span>实卡库存</span>
            <strong>{{ missingCards.length }} 种缺卡</strong>
          </summary>
          <label class="inventory-toggle">
            <input
              :checked="state.inventory.enabled"
              type="checkbox"
              @change="setInventoryEnabled($event.target.checked)"
            >
            <span>启用库存核对</span>
          </label>
          <div v-if="state.inventory.enabled" class="inventory-list">
            <label v-for="card in inventoryRows" :key="card.id">
              <span>{{ card.name }}</span>
              <small>需要 {{ card.required }}</small>
              <input
                :value="card.owned"
                type="number"
                min="0"
                max="99"
                :aria-label="`${card.name}持有数量`"
                @input="setInventoryCount(card.id, $event.target.value)"
              >
            </label>
          </div>
          <button
            v-if="state.inventory.enabled"
            class="inline-command"
            type="button"
            :disabled="!missingCards.length"
            @click="queueMissingCards"
          >
            <Icon icon="ri:printer-line" />
            <span>缺卡加入打印队列</span>
          </button>
        </details>
      </div>
    </section>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { computed, ref, watch } from 'vue';
import {
  applySidePlan,
  cloneAnalysisValue,
  compareDecks,
  createAnalysisPreset,
  createDeckSnapshot,
  diagnoseGoalFailures,
  getMissingCards,
  normalizeAnalysis,
  validateSidePlan,
} from '@/features/playtest/analysis.js';
import {
  fetchBanlistForCards,
  inspectBanlist,
  parseBanlistOverrides,
} from '@/features/playtest/banlist.js';
import {
  calculateGoalProbability,
  calculateRoleProbability,
} from '@/features/playtest/probability.js';
import { countRoleCopies } from '@/features/playtest/roles.js';
import { createAnalysisReportHtml } from '@/features/playtest/report.js';

const props = defineProps({
  analysis: { type: Object, required: true },
  deck: { type: Object, required: true },
  assignments: { type: Object, required: true },
  customRoles: { type: Array, required: true },
  goals: { type: Array, required: true },
  activeGoalId: { type: String, default: '' },
  roleDefinitions: { type: Array, required: true },
  history: { type: Array, required: true },
  cardNames: { type: Object, default: () => ({}) },
  projectName: { type: String, default: '未命名卡组' },
});

const emit = defineEmits([
  'update:analysis',
  'restore-snapshot',
  'apply-side-plan',
  'apply-preset',
  'set-print-queue',
  'notice',
]);

const snapshotName = ref('');
const presetName = ref('');
const presetFileInput = ref(null);
const manualRules = ref('');
const checkingBanlist = ref(false);
const state = computed(() => normalizeAnalysis(props.analysis));
const activeGoal = computed(() =>
  props.goals.find(goal => goal.id === props.activeGoalId) || props.goals[0]);
const activeSnapshot = computed(() =>
  state.value.snapshots.find(item =>
    item.id === state.value.activeSnapshotId) || state.value.snapshots.at(-1));
const activeSidePlan = computed(() =>
  state.value.sidePlans.find(item =>
    item.id === state.value.activeSidePlanId) || state.value.sidePlans[0]);
const activePreset = computed(() =>
  state.value.presets.find(item =>
    item.id === state.value.activePresetId) || null);
const snapshotDiff = computed(() => compareDecks(
  props.deck,
  activeSnapshot.value?.deck,
));
const currentGoalProbability = computed(() => activeGoal.value
  ? calculateGoalProbability(
    props.deck.main || [],
    props.assignments,
    activeGoal.value,
  )
  : { firstFive: 0, goingSecond: 0, sixthDelta: 0 });
const snapshotGoalProbability = computed(() => {
  if (!activeSnapshot.value) return currentGoalProbability.value;
  const goal = activeSnapshot.value.goals.find(item =>
    item.id === activeSnapshot.value.activeGoalId) ||
    activeSnapshot.value.goals[0];
  return goal
    ? calculateGoalProbability(
      activeSnapshot.value.deck.main,
      activeSnapshot.value.roles,
      goal,
    )
    : { firstFive: 0, goingSecond: 0, sixthDelta: 0 };
});
const snapshotGoalDelta = computed(() =>
  currentGoalProbability.value.goingSecond -
  snapshotGoalProbability.value.goingSecond);
const snapshotRoleDeltas = computed(() => {
  if (!activeSnapshot.value) return [];
  return props.roleDefinitions.map(role => {
    const currentCopies = countRoleCopies(
      props.deck.main,
      props.assignments,
      role.id,
      props.roleDefinitions,
    );
    const snapshotCopies = countRoleCopies(
      activeSnapshot.value.deck.main,
      activeSnapshot.value.roles,
      role.id,
      props.roleDefinitions,
    );
    return {
      role,
      copies: currentCopies - snapshotCopies,
      delta: calculateRoleProbability(
        props.deck.main.length,
        currentCopies,
      ).goingSecond - calculateRoleProbability(
        activeSnapshot.value.deck.main.length,
        snapshotCopies,
      ).goingSecond,
    };
  }).filter(item => item.copies || Math.abs(item.delta) > 1e-12);
});
const sidePreview = computed(() => activeSidePlan.value
  ? applySidePlan(props.deck, activeSidePlan.value)
  : { deck: props.deck, errors: [] });
const sidePlanErrors = computed(() => activeSidePlan.value
  ? validateSidePlan(props.deck, activeSidePlan.value)
  : []);
const sideGoalProbability = computed(() => activeGoal.value
  ? calculateGoalProbability(
    sidePreview.value.deck.main,
    props.assignments,
    activeGoal.value,
  )
  : { firstFive: 0, goingSecond: 0, sixthDelta: 0 });
const sideGoalDelta = computed(() =>
  sideGoalProbability.value.goingSecond -
  currentGoalProbability.value.goingSecond);
const sideSwapCount = computed(() =>
  activeSidePlan.value?.swaps.reduce((total, swap) => total + swap.count, 0) || 0);

const groupCards = (cardIds, section = '') => {
  const counts = new Map();
  (cardIds || []).forEach(cardId => {
    const id = String(cardId);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return [...counts].map(([id, count]) => ({
    id,
    count,
    section,
    name: cardName(id),
  }));
};

const mainExtraOptions = computed(() => [
  ...groupCards(props.deck.main, 'main'),
  ...groupCards(props.deck.extra, 'extra'),
]);
const sideOptions = computed(() => groupCards(props.deck.side, 'side'));
const inventoryRows = computed(() => {
  const required = new Map();
  [
    ...(props.deck.main || []),
    ...(props.deck.extra || []),
    ...(props.deck.side || []),
  ].forEach(cardId => {
    const id = String(cardId);
    required.set(id, (required.get(id) || 0) + 1);
  });
  return [...required].map(([id, count]) => ({
    id,
    name: cardName(id),
    required: count,
    owned: state.value.inventory.counts[id] || 0,
  }));
});
const missingCards = computed(() =>
  getMissingCards(props.deck, state.value.inventory));
const banlistResult = computed(() =>
  inspectBanlist(props.deck, state.value.banlist));
const diagnostics = computed(() => diagnoseGoalFailures(
  props.history,
  props.assignments,
  activeGoal.value,
  props.roleDefinitions,
));

const cardName = cardId => props.cardNames[String(cardId)] || String(cardId);
const percent = value => `${(Number(value || 0) * 100).toFixed(1)}%`;
const signedPercent = value => {
  const percentage = Number(value || 0) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
};
const diffCount = diff => diff.added.reduce((total, item) => total + item.count, 0) +
  diff.removed.reduce((total, item) => total + item.count, 0);
const snapshotChangeText = computed(() => {
  const changes = [];
  Object.entries(snapshotDiff.value).forEach(([section, diff]) => {
    diff.added.forEach(item =>
      changes.push(`${sectionLabel(section)} +${cardName(item.id)}×${item.count}`));
    diff.removed.forEach(item =>
      changes.push(`${sectionLabel(section)} -${cardName(item.id)}×${item.count}`));
  });
  return changes.slice(0, 5).join(' · ');
});
const sectionLabel = section => ({
  main: '主卡',
  extra: '额外',
  side: 'Side',
})[section] || section;

const commit = mutator => {
  const next = cloneAnalysisValue(state.value);
  mutator(next);
  emit('update:analysis', normalizeAnalysis(next));
};

const localId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

const addSnapshot = () => {
  const snapshot = createDeckSnapshot({
    deck: props.deck,
    roles: props.assignments,
    customRoles: props.customRoles,
    goals: props.goals,
    activeGoalId: props.activeGoalId,
  }, snapshotName.value.trim());
  commit(next => {
    next.snapshots = [...next.snapshots, snapshot].slice(-20);
    next.activeSnapshotId = snapshot.id;
  });
  snapshotName.value = '';
  emit('notice', `已保存构筑快照“${snapshot.name}”`);
};

const selectSnapshot = id => commit(next => {
  next.activeSnapshotId = id;
});

const restoreSnapshot = () => {
  if (!activeSnapshot.value) return;
  emit('restore-snapshot', cloneAnalysisValue(activeSnapshot.value));
};

const deleteSnapshot = () => {
  if (!activeSnapshot.value) return;
  const id = activeSnapshot.value.id;
  commit(next => {
    next.snapshots = next.snapshots.filter(item => item.id !== id);
    next.activeSnapshotId = next.snapshots.at(-1)?.id || '';
  });
};

const addPreset = () => {
  const preset = createAnalysisPreset({
    roles: props.assignments,
    customRoles: props.customRoles,
    goals: props.goals,
    activeGoalId: props.activeGoalId,
  }, presetName.value.trim());
  commit(next => {
    next.presets = [...next.presets, preset].slice(-12);
    next.activePresetId = preset.id;
  });
  presetName.value = '';
  emit('notice', `已保存分析配置“${preset.name}”`);
};

const selectPreset = id => commit(next => {
  next.activePresetId = id;
});

const applyPreset = () => {
  if (activePreset.value) {
    emit('apply-preset', cloneAnalysisValue(activePreset.value));
  }
};

const deletePreset = () => {
  if (!activePreset.value) return;
  const id = activePreset.value.id;
  commit(next => {
    next.presets = next.presets.filter(item => item.id !== id);
    next.activePresetId = '';
  });
};

const exportPreset = () => {
  if (!activePreset.value) return;
  const payload = JSON.stringify({
    format: 'yugioh-card-analysis',
    version: 1,
    preset: activePreset.value,
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${activePreset.value.name}.ygoanalysis`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const importPreset = async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== 'yugioh-card-analysis' ||
      payload.version !== 1 ||
      !payload.preset) {
      throw new Error('不是有效的分析配置文件');
    }
    const preset = createAnalysisPreset(
      payload.preset,
      payload.preset.name,
    );
    commit(next => {
      next.presets = [...next.presets, preset].slice(-12);
      next.activePresetId = preset.id;
    });
    emit('notice', `已导入分析配置“${preset.name}”`);
  } catch (error) {
    emit('notice', error instanceof Error ? error.message : String(error));
  }
};

const addSidePlan = () => {
  const plan = {
    id: localId('side-plan'),
    name: `换备方案 ${state.value.sidePlans.length + 1}`,
    mode: 'second',
    note: '',
    swaps: [],
  };
  commit(next => {
    next.sidePlans.push(plan);
    next.activeSidePlanId = plan.id;
  });
};

const selectSidePlan = id => commit(next => {
  next.activeSidePlanId = id;
});

const updateSidePlan = patch => {
  if (!activeSidePlan.value) return;
  commit(next => {
    const plan = next.sidePlans.find(item => item.id === activeSidePlan.value.id);
    Object.assign(plan, patch);
  });
};

const addSwap = () => {
  if (!activeSidePlan.value ||
    !mainExtraOptions.value.length ||
    !sideOptions.value.length) return;
  updateSidePlan({
    swaps: [
      ...activeSidePlan.value.swaps,
      {
        outId: mainExtraOptions.value[0].id,
        outSection: mainExtraOptions.value[0].section,
        inId: sideOptions.value[0].id,
        count: 1,
      },
    ],
  });
};

const updateSwap = (index, patch) => {
  const swaps = activeSidePlan.value.swaps.map((swap, swapIndex) =>
    swapIndex === index ? { ...swap, ...patch } : swap);
  updateSidePlan({ swaps });
};

const updateSwapSource = (index, value) => {
  const [outSection, ...idParts] = String(value).split(':');
  updateSwap(index, { outSection, outId: idParts.join(':') });
};

const removeSwap = index => updateSidePlan({
  swaps: activeSidePlan.value.swaps.filter((_, swapIndex) => swapIndex !== index),
});

const deleteSidePlan = () => {
  if (!activeSidePlan.value) return;
  const id = activeSidePlan.value.id;
  commit(next => {
    next.sidePlans = next.sidePlans.filter(item => item.id !== id);
    next.activeSidePlanId = next.sidePlans[0]?.id || '';
  });
};

const applyActiveSidePlan = () => {
  if (!activeSidePlan.value) return;
  const result = applySidePlan(props.deck, activeSidePlan.value);
  if (result.errors.length) {
    emit('notice', result.errors[0]);
    return;
  }
  emit('apply-side-plan', {
    deck: result.deck,
    plan: cloneAnalysisValue(activeSidePlan.value),
  });
};

const updateMetadata = (field, value) => commit(next => {
  next.metadata[field] = value;
});

const updateFormat = format => commit(next => {
  next.metadata.format = format;
  next.banlist.format = format;
  next.banlist.checkedAt = '';
  next.banlist.checkedCardIds = [];
  next.banlist.limits = {};
  next.banlist.names = {};
});

const updateTags = value => updateMetadata(
  'tags',
  String(value).split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
);

const refreshBanlist = async () => {
  checkingBanlist.value = true;
  try {
    const cardIds = [
      ...(props.deck.main || []),
      ...(props.deck.extra || []),
      ...(props.deck.side || []),
    ];
    const result = await fetchBanlistForCards(
      cardIds,
      state.value.metadata.format,
    );
    commit(next => {
      next.banlist = result;
      next.metadata.effectiveDate = result.effectiveDate;
    });
    emit('notice', `已检查 ${result.checkedCardIds.length} 种卡片的当前禁限状态`);
  } catch (error) {
    emit('notice', error instanceof Error ? error.message : String(error));
  } finally {
    checkingBanlist.value = false;
  }
};

const applyManualBanlist = () => {
  const parsed = parseBanlistOverrides(manualRules.value);
  if (parsed.errors.length) {
    emit('notice', parsed.errors[0]);
    return;
  }
  commit(next => {
    next.banlist = {
      format: next.metadata.format,
      effectiveDate: next.metadata.effectiveDate,
      checkedAt: new Date().toISOString(),
      checkedCardIds: Object.keys(parsed.limits),
      limits: parsed.limits,
      names: {},
    };
  });
  emit('notice', `已应用 ${Object.keys(parsed.limits).length} 条手动禁限规则`);
};

const setInventoryEnabled = enabled => commit(next => {
  next.inventory.enabled = enabled;
});

const setInventoryCount = (cardId, value) => commit(next => {
  const count = Math.min(99, Math.max(0, Math.trunc(Number(value) || 0)));
  if (count) {
    next.inventory.counts[String(cardId)] = count;
  } else {
    delete next.inventory.counts[String(cardId)];
  }
});

const queueMissingCards = () => {
  emit('set-print-queue', missingCards.value.map(item => ({
    id: item.id,
    count: item.missing,
  })));
};

const exportReport = () => {
  const roleStats = props.roleDefinitions.map(role => ({
    role,
    ...calculateRoleProbability(
      props.deck.main.length,
      countRoleCopies(
        props.deck.main,
        props.assignments,
        role.id,
        props.roleDefinitions,
      ),
    ),
  }));
  const goalStats = props.goals.map(goal => ({
    ...goal,
    ...calculateGoalProbability(props.deck.main, props.assignments, goal),
  }));
  const html = createAnalysisReportHtml({
    projectName: props.projectName,
    metadata: state.value.metadata,
    deck: props.deck,
    deckSize: props.deck.main.length,
    extraCount: props.deck.extra.length,
    sideCount: props.deck.side.length,
    roleStats,
    goalStats,
    diagnostics: diagnostics.value,
    missingCards: missingCards.value,
    banlistResult: banlistResult.value,
    sidePlans: state.value.sidePlans,
    snapshots: state.value.snapshots,
    cardNames: props.cardNames,
  });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${props.projectName || 'deck'}-analysis.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  emit('notice', '分析报告已导出，可在浏览器中打印为 PDF');
};

watch(
  () => state.value.banlist.limits,
  limits => {
    if (!['master-duel', 'custom'].includes(state.value.metadata.format)) return;
    manualRules.value = Object.entries(limits)
      .map(([cardId, limit]) => `${cardId}=${limit}`)
      .join('\n');
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.analysis-panel {
  padding: 24px 28px;
  border-bottom: 1px solid var(--line);
}

button,
select,
input,
textarea {
  font: inherit;
}

.section-heading {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.section-heading > span {
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
}

.section-heading h2,
.analysis-tool h3,
.project-profile h3 {
  margin: 0;
  font-family: "Songti SC", "STSong", serif;
}

.section-heading h2 {
  font-size: 19px;
}

.section-heading > button,
.analysis-tool header > button,
.tool-select-row button,
.compact-create button,
.preset-row button,
.side-swap-row button {
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: var(--paper);
  cursor: pointer;
}

.section-heading > button {
  height: 32px;
  display: inline-flex;
  gap: 5px;
  padding: 0 9px;
  font-size: 9px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 14px;
}

.analysis-tool,
.project-profile {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  background: var(--paper);
}

.analysis-tool > header,
.project-profile > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.analysis-tool header small,
.project-profile header small {
  color: var(--accent);
  font-size: 7px;
  font-weight: 800;
}

.analysis-tool h3,
.project-profile h3 {
  margin-top: 2px;
  font-size: 15px;
}

.analysis-tool header > strong {
  color: var(--muted);
  font-size: 8px;
}

.analysis-tool header > button,
.tool-select-row button,
.compact-create button,
.preset-row button,
.side-swap-row button {
  width: 32px;
  height: 32px;
  padding: 0;
}

.compact-create,
.tool-select-row,
.preset-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 5px;
}

.preset-transfer {
  display: flex;
  gap: 10px;
  margin-top: 7px;
}

.preset-transfer button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
  font-size: 8px;
}

.preset-transfer button:disabled {
  opacity: 0.4;
}

.visually-hidden {
  width: 1px;
  height: 1px;
  position: absolute;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.tool-select-row {
  grid-template-columns: minmax(0, 1fr) 32px 32px;
  margin-top: 6px;
}

.preset-row {
  grid-template-columns: minmax(90px, 1fr) 32px minmax(86px, 0.9fr) 32px 32px;
  margin-top: 8px;
}

.compact-create input,
.tool-select-row select,
.preset-row input,
.preset-row select,
.side-plan-meta input,
.side-swap-row select,
.side-swap-row input,
.profile-fields input,
.profile-fields select,
.project-notes,
.side-tool textarea,
.profile-columns textarea {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: white;
  font-size: 9px;
}

.snapshot-comparison,
.side-result {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 10px;
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.snapshot-comparison > span,
.side-result > span {
  min-width: 0;
  padding: 8px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.snapshot-comparison small,
.snapshot-comparison strong,
.side-result small,
.side-result strong {
  display: block;
}

.snapshot-comparison small,
.side-result small {
  color: var(--muted);
  font-size: 7px;
}

.snapshot-comparison strong,
.side-result strong {
  margin-top: 3px;
  font-size: 11px;
}

.snapshot-comparison .negative,
.side-result .negative {
  color: var(--accent);
}

.tool-note,
.tool-error,
.tool-empty {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 8px;
  line-height: 1.5;
}

.snapshot-role-deltas {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
  margin-top: 8px;
}

.snapshot-role-deltas span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 8px;
}

.snapshot-role-deltas i {
  width: 7px;
  height: 7px;
}

.snapshot-role-deltas b {
  color: var(--teal);
}

.snapshot-role-deltas b.negative {
  color: var(--accent);
}

.tool-error {
  color: var(--accent);
}

.side-plan-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px;
  margin-top: 7px;
}

.side-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 3px;
}

.side-mode button {
  height: 30px;
  padding: 0 9px;
  border: 0;
  color: var(--muted);
  background: white;
  font-size: 9px;
}

.side-mode button + button {
  border-left: 1px solid var(--line);
}

.side-mode button.active {
  color: white;
  background: var(--ink);
}

.side-swap-list {
  display: grid;
  gap: 5px;
  margin-top: 7px;
}

.side-swap-row {
  display: grid;
  grid-template-columns: minmax(92px, 1fr) 18px minmax(92px, 1fr) 42px 32px;
  align-items: center;
  gap: 4px;
}

.side-swap-row > svg {
  justify-self: center;
  color: var(--muted);
}

.side-swap-row input {
  text-align: center;
}

.inline-command {
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 7px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: white;
  cursor: pointer;
  font-size: 9px;
}

.inline-command:disabled,
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.side-tool textarea,
.project-notes,
.profile-columns textarea {
  width: 100%;
  height: auto;
  margin-top: 7px;
  padding: 7px 8px;
  resize: vertical;
}

.side-result {
  grid-template-columns: repeat(3, 1fr);
}

.project-profile {
  margin-top: 14px;
}

.profile-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.profile-fields label {
  min-width: 0;
}

.profile-fields label > span {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 8px;
}

.profile-fields input,
.profile-fields select {
  width: 100%;
}

.profile-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.profile-columns details {
  min-width: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.profile-columns summary {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  font-size: 9px;
}

.profile-columns summary strong {
  color: var(--teal);
  font-size: 8px;
}

.profile-columns summary strong.error {
  color: var(--accent);
}

.banlist-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.banlist-toolbar button {
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: white;
  font-size: 9px;
}

.banlist-toolbar > span {
  color: var(--muted);
  font-size: 8px;
}

.compact-list,
.inventory-list {
  max-height: 190px;
  overflow: auto;
  margin-top: 7px;
  border-top: 1px solid var(--line);
}

.compact-list > span,
.inventory-list label {
  min-height: 32px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--line);
  font-size: 8px;
}

.compact-list small,
.inventory-list small {
  color: var(--muted);
}

.inventory-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9px;
}

.inventory-toggle input {
  accent-color: var(--teal);
}

.inventory-list label {
  grid-template-columns: minmax(0, 1fr) auto 46px;
}

.inventory-list input {
  width: 46px;
  height: 26px;
  border: 1px solid var(--line);
  text-align: center;
}

.spinning {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .analysis-panel {
    padding: 20px 14px;
  }

  .analysis-grid,
  .profile-columns {
    grid-template-columns: 1fr;
  }

  .profile-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 390px) {
  .preset-row {
    grid-template-columns: minmax(82px, 1fr) 30px minmax(74px, 0.9fr) 30px 30px;
    gap: 3px;
  }

  .side-swap-row {
    grid-template-columns: minmax(70px, 1fr) 14px minmax(70px, 1fr) 36px 30px;
    gap: 3px;
  }

  .snapshot-comparison > span,
  .side-result > span {
    padding: 7px 5px;
  }
}
</style>
