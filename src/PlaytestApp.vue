<template>
  <div class="playtest-app">
    <header class="lab-header">
      <a class="back-link" href="../print/">
        <Icon icon="ri:arrow-left-line" />
        <span>打印工作台</span>
      </a>
      <a class="lab-brand" href="../">
        <span>YG</span>
        <div>
          <h1>试手与概率实验室</h1>
          <p>DRAW LAB · MAIN DECK</p>
        </div>
      </a>
      <strong>{{ mainDeck.length }} 张主卡组</strong>
    </header>

    <ProjectBar
      :project-id="activeProjectId"
      :name="projectName"
      :projects="projects"
      @select="selectProject"
      @rename="projectName = $event"
      @create="createProject"
      @save="saveCurrentProject"
      @duplicate="duplicateCurrentProject"
      @export="exportCurrentProject"
      @import="importProjectFile"
      @remove="removeCurrentProject"
    />
    <div v-if="externalUpdate" class="project-sync-warning">
      <span>项目已在其他标签页更新</span>
      <button type="button" @click="reloadExternalProject">重新载入</button>
    </div>

    <main v-if="currentProject" class="lab-workspace">
      <aside class="role-pane">
        <section class="role-section">
          <div class="section-heading">
            <span>01</span>
            <h2>角色标记</h2>
            <button type="button" title="自动标记公共手坑" @click="runAutoTagging(true)">
              <Icon icon="ri:magic-line" />
              <span>自动标记</span>
            </button>
          </div>

          <div class="role-workflow">
            <div class="role-mode-switch" aria-label="角色标记模式">
              <button
                type="button"
                :class="{ active: markerMode === 'paint' }"
                @click="setMarkerMode('paint')"
              >
                <Icon icon="ri:brush-line" />
                <span>单卡标记</span>
              </button>
              <button
                type="button"
                :class="{ active: markerMode === 'batch' }"
                @click="setMarkerMode('batch')"
              >
                <Icon icon="ri:checkbox-multiple-line" />
                <span>批量选择</span>
              </button>
            </div>
            <div class="role-view-controls">
              <label>
                <Icon icon="ri:stack-line" />
                <select v-model="roleScope" aria-label="角色标记范围">
                  <option value="main">主卡组</option>
                  <option value="side">副卡组</option>
                  <option value="all">全部分区</option>
                </select>
              </label>
              <label>
                <Icon icon="ri:filter-3-line" />
                <select v-model="roleFilter" aria-label="筛选角色">
                  <option value="all">全部卡片</option>
                  <option value="untagged">未标记</option>
                  <option
                    v-for="role in allRoles"
                    :key="role.id"
                    :value="role.id"
                  >
                    {{ role.label }}
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div class="role-actions">
            <button
              v-for="role in allRoles"
              :key="role.id"
              type="button"
              :class="{
                active: markerMode === 'paint'
                  ? activeRoleId === role.id
                  : allSelectedHaveRole(role.id),
              }"
              :style="{ '--role-color': role.color }"
              :disabled="markerMode === 'batch' && !selectedIds.size"
              :aria-pressed="markerMode === 'paint' && activeRoleId === role.id"
              @click="handleRoleAction(role.id)"
            >
              <i :style="{ background: role.color }" />
              <span>{{ role.label }}</span>
              <small>{{ roleMarkedCopies(role.id) }} 张</small>
            </button>
          </div>

          <div v-if="markerMode === 'batch'" class="batch-selection">
            <strong>{{ selectedIds.size }} 种已选</strong>
            <div>
              <button
                type="button"
                title="选择当前列表全部卡片"
                @click="selectAllVisible"
              >
                <Icon icon="ri:checkbox-multiple-line" />
                <span>全选</span>
              </button>
              <button type="button" title="清除选择" @click="clearSelection">
                <Icon icon="ri:checkbox-blank-line" />
                <span>清除</span>
              </button>
            </div>
          </div>

          <form class="custom-role-form" @submit.prevent="addCustomRole">
            <label>
              <span>自定义角色</span>
              <input
                v-model="newRoleName"
                type="text"
                maxlength="12"
                placeholder="例如：一卡动"
                aria-label="自定义角色名称"
              >
            </label>
            <input
              v-model="newRoleColor"
              type="color"
              aria-label="自定义角色颜色"
            >
            <button type="submit" title="添加自定义角色">
              <Icon icon="ri:add-line" />
            </button>
          </form>
          <div v-if="customRoles.length" class="custom-role-list">
            <span v-for="role in customRoles" :key="role.id">
              <i :style="{ background: role.color }" />
              {{ role.label }}
              <button
                type="button"
                :title="`删除${role.label}`"
                @click="deleteCustomRole(role.id)"
              >
                <Icon icon="ri:close-line" />
              </button>
            </span>
          </div>

          <p v-if="notice" class="role-notice">{{ notice }}</p>

          <div v-if="visibleCards.length" class="role-card-grid">
            <article
              v-for="(card, index) in visibleCards"
              :key="card.id"
              :class="{
                selected: markerMode === 'batch' && selectedIds.has(card.id),
                'role-active': markerMode === 'paint' &&
                  cardHasRole(card.id, activeRoleId),
              }"
              :style="{
                '--active-role-color': activeRole?.color || 'var(--teal)',
              }"
            >
              <button
                class="card-select"
                type="button"
                :aria-label="cardRoleActionLabel(card)"
                @click="handleRoleCardClick(card.id, index, $event)"
              >
                <CardMiniature
                  :card-id="card.id"
                  :custom-card="getCustomCard(customCards, card.id)"
                  :resolved-card="cardInfoMap.get(card.id)"
                  :alt="card.name"
                />
                <span
                  class="selection-mark"
                  :class="{
                    marked: markerMode === 'paint' &&
                      cardHasRole(card.id, activeRoleId),
                  }"
                >
                  <Icon :icon="cardRoleActionIcon(card.id)" />
                </span>
                <strong>×{{ card.count }}</strong>
              </button>
              <div class="card-identity">
                <b :title="card.name">{{ card.name }}</b>
                <small>{{ card.number }}</small>
              </div>
              <div class="card-role-list">
                <span
                  v-for="role in rolesForCard(card.id)"
                  :key="role.id"
                  class="card-role-tag"
                  :style="{ '--role-color': role.color }"
                >
                  <i :style="{ background: role.color }" />
                  {{ role.label }}
                </span>
                <span
                  v-if="!rolesForCard(card.id).length"
                  class="card-role-empty"
                >
                  未标记
                </span>
              </div>
            </article>
          </div>
          <div v-else class="role-empty">
            {{ mainDeck.length ? '当前筛选没有卡片' : '主卡组为空' }}
          </div>
        </section>
      </aside>

      <section class="simulation-pane">
        <section class="hand-lab">
          <div class="section-heading">
            <span>02</span>
            <h2>试手</h2>
            <div class="draw-mode">
              <button
                type="button"
                :class="{ active: drawMode === 'first' }"
                @click="drawHand('first')"
              >
                先攻 5
              </button>
              <button
                type="button"
                :class="{ active: drawMode === 'second' }"
                @click="drawHand('second')"
              >
                后攻 5+1
              </button>
            </div>
            <div class="hand-actions">
              <button
                type="button"
                :disabled="!currentHand.firstFive.length"
                title="保留锁定卡并重抽其余卡片"
                @click="redrawUnlocked"
              >
                <Icon icon="ri:refresh-line" />
              </button>
              <button
                type="button"
                :disabled="!mainDeck.length"
                title="重新洗牌并抽取"
                @click="drawHand(drawMode)"
              >
                <Icon icon="ri:shuffle-line" />
              </button>
            </div>
          </div>

          <div v-if="currentHand.firstFive.length" class="hand-board">
            <div class="opening-hand">
              <article
                v-for="(cardId, index) in currentHand.firstFive"
                :key="`${handSequence}-opening-${index}`"
                :class="{ locked: lockedSlots.has(`opening-${index}`) }"
              >
                <div class="hand-card-visual">
                  <CardThumbnail
                    :card-id="cardId"
                    :custom-card="getCustomCard(customCards, cardId)"
                    :alt="cardName(cardId)"
                  />
                  <div class="hand-card-actions">
                    <button
                      type="button"
                      :class="{ active: lockedSlots.has(`opening-${index}`) }"
                      :title="lockedSlots.has(`opening-${index}`) ? '取消锁定' : '锁定卡片'"
                      @click="toggleLockedSlot(`opening-${index}`)"
                    >
                      <Icon
                        :icon="lockedSlots.has(`opening-${index}`) ? 'ri:lock-line' : 'ri:lock-unlock-line'"
                      />
                    </button>
                    <button
                      type="button"
                      title="从卡组随机换一张"
                      @click="swapCard(`opening-${index}`)"
                    >
                      <Icon icon="ri:swap-line" />
                    </button>
                  </div>
                </div>
                <span>{{ cardName(cardId) }}</span>
                <div class="hand-role-list">
                  <i
                    v-for="role in rolesForCard(cardId)"
                    :key="role.id"
                    :style="{ background: role.color }"
                    :title="role.label"
                  />
                </div>
              </article>
            </div>
            <article
              v-if="currentHand.sixth"
              class="sixth-draw"
              :class="{ locked: lockedSlots.has('sixth') }"
            >
              <header>
                <span>+1</span>
                <strong>第六抽</strong>
              </header>
              <div class="hand-card-visual">
                <CardThumbnail
                  :card-id="currentHand.sixth"
                  :custom-card="getCustomCard(customCards, currentHand.sixth)"
                  :alt="cardName(currentHand.sixth)"
                />
                <div class="hand-card-actions">
                  <button
                    type="button"
                    :class="{ active: lockedSlots.has('sixth') }"
                    :title="lockedSlots.has('sixth') ? '取消锁定' : '锁定卡片'"
                    @click="toggleLockedSlot('sixth')"
                  >
                    <Icon
                      :icon="lockedSlots.has('sixth') ? 'ri:lock-line' : 'ri:lock-unlock-line'"
                    />
                  </button>
                  <button
                    type="button"
                    title="从卡组随机换一张"
                    @click="swapCard('sixth')"
                  >
                    <Icon icon="ri:swap-line" />
                  </button>
                </div>
              </div>
              <b>{{ cardName(currentHand.sixth) }}</b>
              <div class="hand-role-list">
                <i
                  v-for="role in rolesForCard(currentHand.sixth)"
                  :key="role.id"
                  :style="{ background: role.color }"
                  :title="role.label"
                />
              </div>
            </article>
          </div>
          <div v-else class="hand-empty">等待主卡组</div>

          <div v-if="drawnRoleSummary.length" class="hand-summary">
            <span
              v-for="item in drawnRoleSummary"
              :key="item.role.id"
            >
              <i :style="{ background: item.role.color }" />
              {{ item.role.label }} {{ item.count }}
            </span>
          </div>
          <div v-if="currentHand.firstFive.length" class="trial-judgement">
            <button
              type="button"
              :class="{ active: currentVerdict === 'hit' }"
              :disabled="!currentHistoryId"
              @click="setCurrentVerdict('hit')"
            >
              <Icon icon="ri:check-line" />
              <span>命中</span>
            </button>
            <button
              type="button"
              :class="{ active: currentVerdict === 'brick' }"
              :disabled="!currentHistoryId"
              @click="setCurrentVerdict('brick')"
            >
              <Icon icon="ri:close-line" />
              <span>废件手</span>
            </button>
            <button
              type="button"
              title="清除判定"
              :disabled="!currentHistoryId || !currentVerdict"
              @click="setCurrentVerdict('')"
            >
              <Icon icon="ri:eraser-line" />
            </button>
            <span>{{ currentHistoryId ? '计入试手统计' : '调整手牌' }}</span>
          </div>
        </section>

        <DeckAnalysisPanel
          :analysis="analysis"
          :deck="deck"
          :assignments="roleAssignments"
          :custom-roles="customRoles"
          :goals="goals"
          :active-goal-id="activeGoalId"
          :role-definitions="allRoles"
          :history="history"
          :card-names="cardNames"
          :project-name="projectName"
          @update:analysis="analysis = $event"
          @restore-snapshot="restoreSnapshot"
          @apply-side-plan="applySidePlanResult"
          @apply-preset="applyAnalysisPreset"
          @set-print-queue="setMissingPrintQueue"
          @notice="notice = $event"
        />

        <section class="goal-lab">
          <div class="section-heading">
            <span>04</span>
            <h2>组合目标</h2>
            <button type="button" title="新增概率目标" @click="addGoal">
              <Icon icon="ri:add-line" />
              <span>新增目标</span>
            </button>
          </div>
          <div v-if="goals.length" class="goal-tabs">
            <button
              v-for="goal in goals"
              :key="goal.id"
              type="button"
              :class="{ active: activeGoalId === goal.id }"
              @click="activeGoalId = goal.id"
            >
              {{ goal.name }}
            </button>
          </div>
          <div v-if="activeGoal" class="goal-editor">
            <div class="goal-title-row">
              <input
                v-model="activeGoal.name"
                type="text"
                maxlength="24"
                aria-label="概率目标名称"
              >
              <div class="goal-mode">
                <button
                  type="button"
                  :class="{ active: activeGoal.mode === 'all' }"
                  @click="activeGoal.mode = 'all'"
                >
                  全部满足
                </button>
                <button
                  type="button"
                  :class="{ active: activeGoal.mode === 'any' }"
                  @click="activeGoal.mode = 'any'"
                >
                  任一满足
                </button>
              </div>
              <button
                type="button"
                title="删除当前目标"
                @click="deleteGoal(activeGoal.id)"
              >
                <Icon icon="ri:delete-bin-line" />
              </button>
            </div>
            <div class="goal-conditions">
              <div
                v-for="(condition, index) in activeGoal.conditions"
                :key="`${activeGoal.id}-${index}`"
                class="goal-condition"
              >
                <select
                  v-model="condition.roleId"
                  :aria-label="`目标条件 ${index + 1} 的角色`"
                >
                  <option
                    v-for="role in allRoles"
                    :key="role.id"
                    :value="role.id"
                  >
                    {{ role.label }}
                  </option>
                </select>
                <select
                  v-model="condition.comparator"
                  :aria-label="`目标条件 ${index + 1} 的比较方式`"
                >
                  <option value="atLeast">至少</option>
                  <option value="atMost">最多</option>
                </select>
                <input
                  v-model.number="condition.count"
                  type="number"
                  min="0"
                  max="6"
                  :aria-label="`目标条件 ${index + 1} 的张数`"
                >
                <span>张</span>
                <button
                  type="button"
                  title="删除条件"
                  :disabled="activeGoal.conditions.length <= 1"
                  @click="removeGoalCondition(index)"
                >
                  <Icon icon="ri:close-line" />
                </button>
              </div>
            </div>
            <button
              class="add-condition"
              type="button"
              :disabled="activeGoal.conditions.length >= 6"
              @click="addGoalCondition"
            >
              <Icon icon="ri:add-line" />
              <span>添加条件</span>
            </button>
            <div class="goal-result">
              <span>
                <small>先攻</small>
                <strong>{{ formatPercent(activeGoalProbability.firstFive) }}</strong>
              </span>
              <span>
                <small>后攻 5+1</small>
                <strong>{{ formatPercent(activeGoalProbability.goingSecond) }}</strong>
              </span>
              <span>
                <small>第六抽变化</small>
                <strong :class="{ negative: activeGoalProbability.sixthDelta < 0 }">
                  {{ formatSignedPercent(activeGoalProbability.sixthDelta) }}
                </strong>
              </span>
              <span>
                <small>实测命中</small>
                <strong>
                  {{ observedGoalStats.hits }} / {{ observedGoalStats.total }}
                </strong>
              </span>
            </div>
          </div>
          <div v-else class="goal-empty">尚未建立概率目标</div>
        </section>

        <section class="diagnosis-lab">
          <div class="section-heading">
            <span>05</span>
            <h2>失败诊断</h2>
            <strong>{{ activeGoal?.name || '未选择目标' }}</strong>
          </div>
          <div v-if="history.length && activeGoal" class="diagnosis-summary">
            <span>
              <small>样本</small>
              <strong>{{ history.length }}</strong>
            </span>
            <span>
              <small>未满足目标</small>
              <strong>{{ failureDiagnostics.failedHands }}</strong>
            </span>
            <span>
              <small>理论命中</small>
              <strong>{{ formatPercent(activeGoalProbability.goingSecond) }}</strong>
            </span>
            <span>
              <small>实测命中</small>
              <strong>{{ formatPercent(observedGoalRate) }}</strong>
            </span>
          </div>
          <div v-if="failureDiagnostics.reasons.length" class="diagnosis-list">
            <article
              v-for="reason in failureDiagnostics.reasons"
              :key="reason.id"
            >
              <span>{{ reason.label }}</span>
              <strong>{{ reason.count }} 次</strong>
              <div>
                <i
                  :style="{
                    width: `${failureDiagnostics.failedHands
                      ? reason.count / failureDiagnostics.failedHands * 100
                      : 0}%`,
                  }"
                />
              </div>
            </article>
          </div>
          <div v-else class="goal-empty">
            {{ history.length ? '当前样本均满足目标' : '完成试手后显示失败原因' }}
          </div>
        </section>

        <section class="probability-lab">
          <div class="section-heading">
            <span>06</span>
            <h2>角色上手率</h2>
            <strong>精确组合概率</strong>
          </div>
          <div class="probability-head">
            <span>角色</span>
            <span>投入</span>
            <span>先攻</span>
            <span>后攻 5+1</span>
          </div>
          <article
            v-for="stat in roleStats"
            :key="stat.role.id"
            class="probability-row"
          >
            <span class="probability-role">
              <i :style="{ background: stat.role.color }" />
              <strong>{{ stat.role.label }}</strong>
            </span>
            <b>{{ stat.copies }} / {{ mainDeck.length }}</b>
            <strong>{{ formatPercent(stat.firstFive) }}</strong>
            <strong>
              {{ formatPercent(stat.goingSecond) }}
              <small>
                （{{ formatPercent(stat.firstFive) }} +
                {{ formatPercent(stat.sixthOnly) }}）
              </small>
            </strong>
            <div class="role-distribution">
              <span>0 张 {{ formatPercent(stat.distribution.zero) }}</span>
              <span>1 张 {{ formatPercent(stat.distribution.one) }}</span>
              <span>2 张 {{ formatPercent(stat.distribution.two) }}</span>
              <span>3+ {{ formatPercent(stat.distribution.threePlus) }}</span>
            </div>
            <div class="probability-meter">
              <i
                :style="{
                  width: `${stat.goingSecond * 100}%`,
                  background: stat.role.color,
                }"
              />
            </div>
          </article>
        </section>

        <section class="history-lab">
          <div class="section-heading">
            <span>07</span>
            <h2>试手历史</h2>
            <button
              type="button"
              title="清空试手历史"
              :disabled="!history.length"
              @click="clearHistory"
            >
              <Icon icon="ri:delete-bin-line" />
            </button>
          </div>
          <div class="history-stats">
            <span>
              <small>试手</small>
              <strong>{{ historyStats.total }}</strong>
            </span>
            <span>
              <small>已判定</small>
              <strong>{{ historyStats.judged }}</strong>
            </span>
            <span>
              <small>命中率</small>
              <strong>{{ formatPercent(historyStats.hitRate) }}</strong>
            </span>
            <span>
              <small>废件手</small>
              <strong>{{ historyStats.bricks }}</strong>
            </span>
          </div>
          <div v-if="recentHistory.length" class="history-list">
            <button
              v-for="entry in recentHistory"
              :key="entry.id"
              type="button"
              :class="[
                entry.verdict,
                { active: currentHistoryId === entry.id },
              ]"
              @click="restoreHistory(entry)"
            >
              <span>{{ entry.mode === 'second' ? '后攻' : '先攻' }}</span>
              <strong>{{ historyCardNames(entry) }}</strong>
              <small>{{ entry.verdict === 'hit' ? '命中' : entry.verdict === 'brick' ? '废件手' : '未判定' }}</small>
            </button>
          </div>
          <div v-else class="history-empty">暂无试手记录</div>
        </section>
      </section>
    </main>

    <main v-else class="empty-workspace">
      <Icon icon="ri:shuffle-line" />
      <strong>没有可分析的卡组项目</strong>
      <a href="../print/">打开打印工作台</a>
    </main>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import CardMiniature from '@/components/CardMiniature.vue';
import CardThumbnail from '@/components/CardThumbnail.vue';
import DeckAnalysisPanel from '@/components/DeckAnalysisPanel.vue';
import ProjectBar from '@/components/ProjectBar.vue';
import { resolveCard } from '@/features/cards/card-service.js';
import { getCustomCard } from '@/features/cards/custom-card.js';
import {
  deleteProject,
  duplicateProject,
  getActiveProjectId,
  getProject,
  listProjects,
  parseProject,
  saveProject,
  serializeProject,
  setActiveProjectId,
  subscribeProjectChanges,
} from '@/features/projects/project-store.js';
import {
  createDeckSnapshot,
  createEmptyAnalysis,
  diagnoseGoalFailures,
  normalizeAnalysis,
} from '@/features/playtest/analysis.js';
import {
  calculateDrawDistribution,
  calculateGoalProbability,
  calculateRoleProbability,
  drawTestHand,
  goalMatchesHand,
  redrawUnlockedHand,
  swapHandCard,
} from '@/features/playtest/probability.js';
import {
  ROLE_COLOR_PALETTE,
  autoTagKnownHandTraps,
  countRoleCopies,
  getRoleDefinitions,
  normalizeCustomRoles,
  normalizeRoleAssignments,
  removeRole,
  toggleRoleForCards,
} from '@/features/playtest/roles.js';
import { runWithConcurrency } from '@/features/print/concurrency.js';

const projects = ref([]);
const currentProject = ref(null);
const activeProjectId = ref('');
const activeProjectRevision = ref(0);
const projectName = ref('未命名卡组');
const deck = ref({ main: [], extra: [], side: [] });
const customCards = ref({});
const printQueue = ref([]);
const roleAssignments = ref({});
const autoTaggedCardIds = ref([]);
const customRoles = ref([]);
const goals = ref([]);
const activeGoalId = ref('');
const history = ref([]);
const analysis = ref(createEmptyAnalysis());
const selectedIds = ref(new Set());
const markerMode = ref('paint');
const activeRoleId = ref('starter');
const roleFilter = ref('all');
const roleScope = ref('main');
const notice = ref('');
const externalUpdate = ref(null);
const cardInfoMap = ref(new Map());
const drawMode = ref('first');
const currentHand = ref({ firstFive: [], sixth: '', remaining: [] });
const currentHistoryId = ref('');
const lockedSlots = ref(new Set());
const newRoleName = ref('');
const newRoleColor = ref(ROLE_COLOR_PALETTE[0]);
const handSequence = ref(0);
let lastSelectedIndex = -1;
let saveTimer;
let loadingProject = false;
let unsubscribeProjectChanges = () => {};

const mainDeck = computed(() => deck.value.main.map(String));
const allDeckCardIds = computed(() => [
  ...deck.value.main,
  ...deck.value.extra,
  ...deck.value.side,
].map(String));
const allRoles = computed(() => getRoleDefinitions(customRoles.value));
const groupCards = cardIds => {
  const grouped = new Map();
  cardIds.forEach(id => {
    grouped.set(id, (grouped.get(id) || 0) + 1);
  });
  return [...grouped].map(([id, count]) => ({
    id,
    count,
    name: cardName(id),
    number: getCustomCard(customCards.value, id)?.data?.password || id,
  }));
};
const uniqueDeckCards = computed(() => groupCards(allDeckCardIds.value));
const scopedRoleCardIds = computed(() => {
  if (roleScope.value === 'side') {
    return deck.value.side.map(String);
  }
  if (roleScope.value === 'all') return allDeckCardIds.value;
  return mainDeck.value;
});
const scopedRoleCards = computed(() => groupCards(scopedRoleCardIds.value));
const visibleCards = computed(() => scopedRoleCards.value.filter(card => {
  const roles = roleAssignments.value[card.id] || [];
  if (roleFilter.value === 'all') return true;
  if (roleFilter.value === 'untagged') return !roles.length;
  return roles.includes(roleFilter.value);
}));
const activeRole = computed(() =>
  allRoles.value.find(role => role.id === activeRoleId.value) ||
  allRoles.value[0] ||
  null);

const normalizeRoleTool = () => {
  if (!allRoles.value.some(role => role.id === activeRoleId.value)) {
    activeRoleId.value = allRoles.value[0]?.id || 'starter';
  }
  if (
    !['all', 'untagged'].includes(roleFilter.value) &&
    !allRoles.value.some(role => role.id === roleFilter.value)
  ) {
    roleFilter.value = 'all';
  }
};
const roleStats = computed(() => allRoles.value.map(role => ({
  role,
  ...calculateRoleProbability(
    mainDeck.value.length,
    countRoleCopies(
      mainDeck.value,
      roleAssignments.value,
      role.id,
      allRoles.value,
    ),
  ),
  distribution: calculateDrawDistribution(
    mainDeck.value.length,
    countRoleCopies(
      mainDeck.value,
      roleAssignments.value,
      role.id,
      allRoles.value,
    ),
    5,
  ),
})));
const drawnRoleSummary = computed(() => {
  const cardIds = [
    ...currentHand.value.firstFive,
    ...(currentHand.value.sixth ? [currentHand.value.sixth] : []),
  ];
  return allRoles.value.map(role => ({
    role,
    count: countRoleCopies(
      cardIds,
      roleAssignments.value,
      role.id,
      allRoles.value,
    ),
  })).filter(item => item.count);
});
const activeGoal = computed(() =>
  goals.value.find(goal => goal.id === activeGoalId.value) || null);
const activeGoalProbability = computed(() => activeGoal.value
  ? calculateGoalProbability(
    mainDeck.value,
    roleAssignments.value,
    activeGoal.value,
  )
  : { firstFive: 0, goingSecond: 0, sixthDelta: 0 });
const recentHistory = computed(() => [...history.value].reverse().slice(0, 12));
const historyStats = computed(() => {
  const judged = history.value.filter(entry => entry.verdict);
  const hits = judged.filter(entry => entry.verdict === 'hit').length;
  return {
    total: history.value.length,
    judged: judged.length,
    hits,
    bricks: judged.filter(entry => entry.verdict === 'brick').length,
    hitRate: judged.length ? hits / judged.length : 0,
  };
});
const observedGoalStats = computed(() => {
  if (!activeGoal.value) return { total: 0, hits: 0 };
  const total = history.value.length;
  const hits = history.value.filter(entry => goalMatchesHand(
    [
      ...entry.firstFive,
      ...(entry.mode === 'second' && entry.sixth ? [entry.sixth] : []),
    ],
    roleAssignments.value,
    activeGoal.value,
  )).length;
  return { total, hits };
});
const observedGoalRate = computed(() => observedGoalStats.value.total
  ? observedGoalStats.value.hits / observedGoalStats.value.total
  : 0);
const failureDiagnostics = computed(() => diagnoseGoalFailures(
  history.value,
  roleAssignments.value,
  activeGoal.value,
  allRoles.value,
));
const currentVerdict = computed(() =>
  history.value.find(entry => entry.id === currentHistoryId.value)?.verdict || '');
const cardNames = computed(() => Object.fromEntries(
  uniqueDeckCards.value.map(card => [card.id, card.name]),
));

const cardName = cardId => {
  const customCard = getCustomCard(customCards.value, cardId);
  if (customCard) return customCard.name;
  return cardInfoMap.value.get(String(cardId))?.name || String(cardId);
};

const rolesForCard = cardId => {
  const roleIds = roleAssignments.value[String(cardId)] || [];
  return allRoles.value.filter(role => roleIds.includes(role.id));
};

const cardHasRole = (cardId, roleId) =>
  Boolean(roleId && roleAssignments.value[String(cardId)]?.includes(roleId));

const roleMarkedCopies = roleId => countRoleCopies(
  scopedRoleCardIds.value,
  roleAssignments.value,
  roleId,
  allRoles.value,
);

const formatPercent = value => `${(Number(value || 0) * 100).toFixed(1)}%`;
const formatSignedPercent = value => {
  const percentage = Number(value || 0) * 100;
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
};

const createLocalId = prefix => {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const createDefaultGoal = () => ({
  id: createLocalId('goal'),
  name: '初动 + 补点',
  mode: 'all',
  conditions: [
    { roleId: 'starter', comparator: 'atLeast', count: 1 },
    { roleId: 'extender', comparator: 'atLeast', count: 1 },
  ],
});

const normalizeGoals = values => {
  const validRoleIds = new Set(allRoles.value.map(role => role.id));
  return (Array.isArray(values) ? values : []).map((goal, goalIndex) => ({
    id: String(goal?.id || createLocalId(`goal-${goalIndex + 1}`)),
    name: String(goal?.name || `目标 ${goalIndex + 1}`).trim().slice(0, 24) ||
      `目标 ${goalIndex + 1}`,
    mode: goal?.mode === 'any' ? 'any' : 'all',
    conditions: (Array.isArray(goal?.conditions) ? goal.conditions : [])
      .map(condition => ({
        roleId: validRoleIds.has(String(condition?.roleId || ''))
          ? String(condition.roleId)
          : allRoles.value[0]?.id || 'starter',
        comparator: condition?.comparator === 'atMost'
          ? 'atMost'
          : 'atLeast',
        count: Math.min(6, Math.max(
          0,
          Math.trunc(Number(condition?.count) || 0),
        )),
      }))
      .slice(0, 6),
  })).map(goal => ({
    ...goal,
    conditions: goal.conditions.length
      ? goal.conditions
      : [{
        roleId: allRoles.value[0]?.id || 'starter',
        comparator: 'atLeast',
        count: 1,
      }],
  }));
};

const replaceSelection = values => {
  selectedIds.value = new Set(values);
};

const toggleCardSelection = (cardId, index, event) => {
  const next = new Set(selectedIds.value);
  if (event.shiftKey && lastSelectedIndex >= 0) {
    const start = Math.min(lastSelectedIndex, index);
    const end = Math.max(lastSelectedIndex, index);
    visibleCards.value
      .slice(start, end + 1)
      .forEach(card => next.add(card.id));
  } else if (next.has(cardId)) {
    next.delete(cardId);
  } else {
    next.add(cardId);
  }
  lastSelectedIndex = index;
  replaceSelection(next);
};

const selectAllVisible = () => {
  replaceSelection(visibleCards.value.map(card => card.id));
};

const clearSelection = () => {
  replaceSelection([]);
  lastSelectedIndex = -1;
};

const setMarkerMode = mode => {
  markerMode.value = mode === 'batch' ? 'batch' : 'paint';
  if (markerMode.value === 'paint') clearSelection();
};

const allSelectedHaveRole = roleId => {
  return selectedIds.value.size > 0 &&
    [...selectedIds.value].every(id =>
      roleAssignments.value[id]?.includes(roleId));
};

const toggleSelectedRole = roleId => {
  roleAssignments.value = toggleRoleForCards(
    roleAssignments.value,
    [...selectedIds.value],
    roleId,
    allRoles.value,
  );
  const role = allRoles.value.find(item => item.id === roleId);
  notice.value = `已更新 ${selectedIds.value.size} 种卡片的${role?.label || ''}标记`;
};

const handleRoleAction = roleId => {
  if (markerMode.value === 'batch') {
    toggleSelectedRole(roleId);
    return;
  }
  activeRoleId.value = roleId;
};

const handleRoleCardClick = (cardId, index, event) => {
  if (markerMode.value === 'batch') {
    toggleCardSelection(cardId, index, event);
    return;
  }
  const role = activeRole.value;
  if (!role) return;
  const wasMarked = cardHasRole(cardId, role.id);
  roleAssignments.value = toggleRoleForCards(
    roleAssignments.value,
    [cardId],
    role.id,
    allRoles.value,
  );
  notice.value = `${cardName(cardId)} · ${
    wasMarked ? '移除' : '标记为'
  }${role.label}`;
};

const cardRoleActionLabel = card => {
  if (markerMode.value === 'batch') {
    return `${selectedIds.value.has(card.id) ? '取消选择' : '选择'} ${card.name}`;
  }
  const role = activeRole.value;
  if (!role) return card.name;
  return `${cardHasRole(card.id, role.id) ? '移除' : '标记'} ${
    card.name
  } ${role.label}`;
};

const cardRoleActionIcon = cardId => {
  if (markerMode.value === 'batch') {
    return selectedIds.value.has(cardId) ? 'ri:check-line' : 'ri:add-line';
  }
  return cardHasRole(cardId, activeRoleId.value)
    ? 'ri:check-line'
    : 'ri:brush-line';
};

const addCustomRole = () => {
  const label = newRoleName.value.trim();
  if (!label) return;
  if (allRoles.value.some(role => role.label === label)) {
    notice.value = `角色“${label}”已存在`;
    return;
  }
  const role = {
    id: createLocalId('custom'),
    label,
    color: newRoleColor.value,
  };
  customRoles.value = normalizeCustomRoles([
    ...customRoles.value,
    role,
  ]);
  activeRoleId.value = role.id;
  setMarkerMode('paint');
  newRoleName.value = '';
  newRoleColor.value = ROLE_COLOR_PALETTE[
    customRoles.value.length % ROLE_COLOR_PALETTE.length
  ];
  notice.value = `已添加角色“${label}”`;
};

const deleteCustomRole = roleId => {
  const role = customRoles.value.find(item => item.id === roleId);
  if (!role || !window.confirm(`删除角色“${role.label}”及其全部标记？`)) {
    return;
  }
  const remainingRoles = allRoles.value.filter(item => item.id !== roleId);
  roleAssignments.value = removeRole(
    roleAssignments.value,
    roleId,
    remainingRoles,
  );
  customRoles.value = customRoles.value.filter(item => item.id !== roleId);
  normalizeRoleTool();
  goals.value = goals.value.map(goal => ({
    ...goal,
    conditions: goal.conditions.filter(condition =>
      condition.roleId !== roleId),
  }));
  goals.value = normalizeGoals(goals.value);
  if (roleFilter.value === roleId) roleFilter.value = 'all';
  notice.value = `已删除角色“${role.label}”`;
};

const runAutoTagging = (force = false) => {
  const checked = new Set(autoTaggedCardIds.value);
  const sourceIds = force
    ? uniqueDeckCards.value.map(card => card.id)
    : uniqueDeckCards.value
      .map(card => card.id)
      .filter(id => !checked.has(id));
  const result = autoTagKnownHandTraps(
    sourceIds,
    roleAssignments.value,
    allRoles.value,
  );
  roleAssignments.value = result.assignments;
  sourceIds.forEach(id => checked.add(id));
  autoTaggedCardIds.value = [...checked];
  if (force || result.taggedIds.length) {
    const copies = mainDeck.value.filter(id =>
      result.taggedIds.includes(id)).length;
    notice.value = result.taggedIds.length
      ? `自动标记 ${result.taggedIds.length} 种公共手坑，共 ${copies} 张`
      : '未发现新的公共手坑';
  }
  return result.taggedIds.length > 0 || sourceIds.length > 0;
};

const recordHand = (hand, mode) => {
  const entry = {
    id: createLocalId('hand'),
    mode,
    firstFive: [...hand.firstFive],
    sixth: hand.sixth || '',
    verdict: '',
    createdAt: new Date().toISOString(),
  };
  history.value = [...history.value, entry].slice(-60);
  currentHistoryId.value = entry.id;
};

const drawHand = (mode, options = {}) => {
  drawMode.value = mode === 'second' ? 'second' : 'first';
  currentHand.value = drawTestHand(mainDeck.value, {
    goingSecond: drawMode.value === 'second',
  });
  lockedSlots.value = new Set();
  if (options.record !== false && currentHand.value.firstFive.length) {
    recordHand(currentHand.value, drawMode.value);
  } else {
    currentHistoryId.value = '';
  }
  handSequence.value += 1;
};

const toggleLockedSlot = slot => {
  const next = new Set(lockedSlots.value);
  if (next.has(slot)) {
    next.delete(slot);
  } else {
    next.add(slot);
  }
  lockedSlots.value = next;
};

const redrawUnlocked = () => {
  currentHand.value = redrawUnlockedHand(
    mainDeck.value,
    currentHand.value,
    lockedSlots.value,
  );
  currentHistoryId.value = '';
  handSequence.value += 1;
};

const swapCard = slot => {
  currentHand.value = swapHandCard(currentHand.value, slot);
  lockedSlots.value = new Set(
    [...lockedSlots.value].filter(value => value !== slot),
  );
  currentHistoryId.value = '';
  handSequence.value += 1;
};

const setCurrentVerdict = verdict => {
  if (!currentHistoryId.value) return;
  history.value = history.value.map(entry => entry.id === currentHistoryId.value
    ? { ...entry, verdict }
    : entry);
};

const restoreHistory = entry => {
  const remaining = [...mainDeck.value];
  [...entry.firstFive, ...(entry.sixth ? [entry.sixth] : [])]
    .forEach(cardId => {
      const index = remaining.indexOf(cardId);
      if (index >= 0) remaining.splice(index, 1);
    });
  currentHand.value = {
    firstFive: [...entry.firstFive],
    sixth: entry.sixth || '',
    remaining,
  };
  drawMode.value = entry.mode;
  currentHistoryId.value = entry.id;
  lockedSlots.value = new Set();
  handSequence.value += 1;
};

const clearHistory = () => {
  if (!window.confirm('清空全部试手历史？')) return;
  history.value = [];
  currentHistoryId.value = '';
};

const historyCardNames = entry => [
  ...entry.firstFive,
  ...(entry.sixth ? [entry.sixth] : []),
].map(cardName).join(' / ');

const addGoal = () => {
  const goal = {
    id: createLocalId('goal'),
    name: `目标 ${goals.value.length + 1}`,
    mode: 'all',
    conditions: [{
      roleId: allRoles.value[0]?.id || 'starter',
      comparator: 'atLeast',
      count: 1,
    }],
  };
  goals.value = [...goals.value, goal];
  activeGoalId.value = goal.id;
};

const deleteGoal = goalId => {
  goals.value = goals.value.filter(goal => goal.id !== goalId);
  activeGoalId.value = goals.value[0]?.id || '';
};

const addGoalCondition = () => {
  if (!activeGoal.value || activeGoal.value.conditions.length >= 6) return;
  activeGoal.value.conditions.push({
    roleId: allRoles.value[0]?.id || 'starter',
    comparator: 'atLeast',
    count: 1,
  });
};

const removeGoalCondition = index => {
  if (!activeGoal.value || activeGoal.value.conditions.length <= 1) return;
  activeGoal.value.conditions.splice(index, 1);
};

const loadCardInfo = async () => {
  const unresolvedIds = uniqueDeckCards.value
    .map(card => card.id)
    .filter(id =>
      !getCustomCard(customCards.value, id) &&
      !cardInfoMap.value.has(id));
  await runWithConcurrency(
    unresolvedIds.map(id => async () => {
      try {
        const resolved = await resolveCard(id);
        cardInfoMap.value = new Map(cardInfoMap.value)
          .set(id, resolved);
      } catch {
        cardInfoMap.value = new Map(cardInfoMap.value)
          .set(id, { id, name: id });
      }
    }),
    4,
  );
};

const addAutomaticSnapshot = name => {
  const snapshot = createDeckSnapshot({
    deck: deck.value,
    roles: roleAssignments.value,
    customRoles: customRoles.value,
    goals: goals.value,
    activeGoalId: activeGoalId.value,
  }, name);
  analysis.value = normalizeAnalysis({
    ...analysis.value,
    snapshots: [...analysis.value.snapshots, snapshot].slice(-20),
    activeSnapshotId: snapshot.id,
  });
};

const resetHandForDeckChange = () => {
  currentHand.value = { firstFive: [], sixth: '', remaining: [] };
  currentHistoryId.value = '';
  lockedSlots.value = new Set();
  drawHand(drawMode.value, { record: false });
};

const restoreSnapshot = async snapshot => {
  loadingProject = true;
  deck.value = {
    main: [...snapshot.deck.main],
    extra: [...snapshot.deck.extra],
    side: [...snapshot.deck.side],
  };
  customRoles.value = normalizeCustomRoles(snapshot.customRoles);
  normalizeRoleTool();
  roleAssignments.value = normalizeRoleAssignments(
    snapshot.roles,
    allRoles.value,
  );
  goals.value = normalizeGoals(snapshot.goals);
  activeGoalId.value = goals.value.some(goal =>
    goal.id === snapshot.activeGoalId)
    ? snapshot.activeGoalId
    : goals.value[0]?.id || '';
  cardInfoMap.value = new Map();
  resetHandForDeckChange();
  await loadCardInfo();
  loadingProject = false;
  notice.value = `已恢复构筑快照“${snapshot.name}”`;
  await saveCurrentProject();
};

const applySidePlanResult = async ({ deck: nextDeck, plan }) => {
  addAutomaticSnapshot(`换备前 · ${plan.name}`);
  deck.value = {
    main: [...nextDeck.main],
    extra: [...nextDeck.extra],
    side: [...nextDeck.side],
  };
  cardInfoMap.value = new Map();
  resetHandForDeckChange();
  await loadCardInfo();
  notice.value = `已应用“${plan.name}”，并保存换备前快照`;
};

const applyAnalysisPreset = preset => {
  customRoles.value = normalizeCustomRoles(preset.customRoles);
  normalizeRoleTool();
  roleAssignments.value = normalizeRoleAssignments(
    preset.roles,
    allRoles.value,
  );
  goals.value = normalizeGoals(preset.goals);
  activeGoalId.value = goals.value.some(goal =>
    goal.id === preset.activeGoalId)
    ? preset.activeGoalId
    : goals.value[0]?.id || '';
  notice.value = `已应用分析配置“${preset.name}”`;
};

const setMissingPrintQueue = entries => {
  printQueue.value = entries.map(entry => ({
    id: String(entry.id),
    count: Math.min(99, Math.max(0, Number(entry.count) || 0)),
  })).filter(entry => entry.count > 0);
  notice.value = `已将 ${printQueue.value.length} 种缺卡写入打印队列`;
};

const projectSnapshot = () => {
  const baseProject = JSON.parse(JSON.stringify(currentProject.value || {}));
  return {
    ...baseProject,
    id: activeProjectId.value,
    revision: activeProjectRevision.value,
    kind: 'deck',
    name: projectName.value,
    deck: {
      main: [...deck.value.main],
      extra: [...deck.value.extra],
      side: [...deck.value.side],
    },
    customCards: JSON.parse(JSON.stringify(customCards.value)),
    printQueue: JSON.parse(JSON.stringify(printQueue.value)),
    playtest: {
      roles: normalizeRoleAssignments(
        roleAssignments.value,
        allRoles.value,
      ),
      autoTaggedCardIds: [...autoTaggedCardIds.value],
      customRoles: normalizeCustomRoles(customRoles.value),
      goals: normalizeGoals(goals.value),
      activeGoalId: activeGoalId.value,
      history: history.value.slice(-60),
      analysis: normalizeAnalysis(analysis.value),
    },
  };
};

const refreshProjects = async () => {
  projects.value = await listProjects('deck');
};

const saveCurrentProject = async () => {
  if (!currentProject.value) return null;
  try {
    const saved = await saveProject(projectSnapshot());
    currentProject.value = JSON.parse(JSON.stringify(saved));
    activeProjectId.value = saved.id;
    activeProjectRevision.value = saved.revision;
    projectName.value = saved.name;
    externalUpdate.value = null;
    setActiveProjectId(saved.id);
    await refreshProjects();
    notice.value = '试手数据已保存';
    return saved;
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error);
    return null;
  }
};

const applyProject = async project => {
  if (!project || project.kind !== 'deck') return;
  loadingProject = true;
  currentProject.value = JSON.parse(JSON.stringify(project));
  activeProjectId.value = project.id;
  activeProjectRevision.value = project.revision || 0;
  projectName.value = project.name;
  externalUpdate.value = null;
  deck.value = {
    main: [...(project.deck?.main || [])],
    extra: [...(project.deck?.extra || [])],
    side: [...(project.deck?.side || [])],
  };
  customCards.value = JSON.parse(JSON.stringify(project.customCards || {}));
  printQueue.value = JSON.parse(JSON.stringify(project.printQueue || []));
  customRoles.value = normalizeCustomRoles(project.playtest?.customRoles);
  normalizeRoleTool();
  roleAssignments.value = normalizeRoleAssignments(
    project.playtest?.roles,
    allRoles.value,
  );
  autoTaggedCardIds.value = [
    ...(project.playtest?.autoTaggedCardIds || []),
  ].map(String);
  goals.value = normalizeGoals(project.playtest?.goals);
  let changed = false;
  if (!goals.value.length) {
    goals.value = [createDefaultGoal()];
    changed = true;
  }
  activeGoalId.value = goals.value.some(goal =>
    goal.id === project.playtest?.activeGoalId)
    ? project.playtest.activeGoalId
    : goals.value[0].id;
  history.value = (project.playtest?.history || []).slice(-60);
  analysis.value = normalizeAnalysis(project.playtest?.analysis);
  clearSelection();
  cardInfoMap.value = new Map();
  changed = runAutoTagging(false) || changed;
  if (history.value.length) {
    restoreHistory(history.value.at(-1));
  } else {
    drawHand('first');
    changed = true;
  }
  setActiveProjectId(project.id);
  await loadCardInfo();
  loadingProject = false;
  if (changed) await saveCurrentProject();
};

const selectProject = async id => {
  if (!id) {
    createProject();
    return;
  }
  await applyProject(await getProject(id));
};

const createProject = () => {
  loadingProject = true;
  currentProject.value = {
    kind: 'deck',
    deck: { main: [], extra: [], side: [] },
    customCards: {},
  };
  activeProjectId.value = '';
  activeProjectRevision.value = 0;
  projectName.value = '未命名卡组';
  deck.value = { main: [], extra: [], side: [] };
  customCards.value = {};
  printQueue.value = [];
  roleAssignments.value = {};
  autoTaggedCardIds.value = [];
  customRoles.value = [];
  markerMode.value = 'paint';
  activeRoleId.value = 'starter';
  roleFilter.value = 'all';
  roleScope.value = 'main';
  goals.value = [createDefaultGoal()];
  activeGoalId.value = goals.value[0].id;
  history.value = [];
  analysis.value = createEmptyAnalysis();
  currentHand.value = { firstFive: [], sixth: '', remaining: [] };
  currentHistoryId.value = '';
  lockedSlots.value = new Set();
  clearSelection();
  setActiveProjectId('');
  setTimeout(() => {
    loadingProject = false;
  });
};

const reloadExternalProject = async () => {
  if (!activeProjectId.value) return;
  await applyProject(await getProject(activeProjectId.value));
  await refreshProjects();
  notice.value = '已载入其他标签页的最新版本';
};

const duplicateCurrentProject = async () => {
  const saved = await duplicateProject(projectSnapshot());
  await refreshProjects();
  await applyProject(saved);
  notice.value = '已创建卡组副本';
};

const removeCurrentProject = async () => {
  if (!activeProjectId.value ||
    !window.confirm(`删除“${projectName.value}”？此操作无法撤销。`)) {
    return;
  }
  await deleteProject(activeProjectId.value);
  await refreshProjects();
  if (projects.value.length) {
    await applyProject(projects.value[0]);
  } else {
    currentProject.value = null;
    createProject();
  }
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const exportCurrentProject = () => {
  if (!currentProject.value) return;
  downloadBlob(
    new Blob([serializeProject(projectSnapshot())], {
      type: 'application/json;charset=utf-8',
    }),
    `${projectName.value || 'yugioh-deck'}.ygoproject`,
  );
};

const importProjectFile = async file => {
  try {
    const imported = parseProject(await file.text());
    if (imported.kind !== 'deck') {
      throw new Error('这个文件不是卡组项目');
    }
    const saved = await saveProject(imported);
    await refreshProjects();
    await applyProject(saved);
    notice.value = '卡组项目已导入';
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error);
  }
};

watch(
  () => ({
    name: projectName.value,
    roles: roleAssignments.value,
    autoTaggedCardIds: autoTaggedCardIds.value,
    customRoles: customRoles.value,
    goals: goals.value,
    activeGoalId: activeGoalId.value,
    history: history.value,
    analysis: analysis.value,
    deck: deck.value,
    printQueue: printQueue.value,
  }),
  () => {
    if (!activeProjectId.value || loadingProject || externalUpdate.value) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentProject, 700);
  },
  { deep: true },
);

onMounted(async () => {
  unsubscribeProjectChanges = subscribeProjectChanges(change => {
    if (change?.type === 'saved' &&
      change.id === activeProjectId.value &&
      change.revision > activeProjectRevision.value) {
      clearTimeout(saveTimer);
      externalUpdate.value = change;
    }
  });
  try {
    await refreshProjects();
    const activeId = getActiveProjectId();
    const activeProject = activeId ? await getProject(activeId) : null;
    if (activeProject?.kind === 'deck') {
      await applyProject(activeProject);
    } else if (projects.value.length) {
      await applyProject(projects.value[0]);
    }
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error);
  }
});

onBeforeUnmount(() => {
  clearTimeout(saveTimer);
  unsubscribeProjectChanges();
});
</script>

<style lang="scss" scoped>
.playtest-app {
  --paper: #fffefa;
  --canvas: #f2f0ea;
  --ink: #1c1d1b;
  --muted: #74736e;
  --line: #d7d3ca;
  --accent: #b64734;
  --teal: #285e58;
  min-height: 100vh;
  color: var(--ink);
  background: var(--canvas);
  font-family: "Avenir Next", "PingFang SC", "Hiragino Sans GB", sans-serif;
}

button,
select,
input {
  font: inherit;
}

.lab-header {
  height: 72px;
  display: grid;
  grid-template-columns: 180px 1fr 180px;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
}

.back-link,
.lab-brand {
  color: inherit;
  text-decoration: none;
}

.back-link {
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.lab-brand {
  display: flex;
  align-items: center;
  justify-self: center;
  gap: 12px;
}

.lab-brand > span {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ink);
  font-size: 10px;
  font-weight: 800;
}

.lab-brand h1,
.lab-brand p {
  margin: 0;
}

.lab-brand h1 {
  font-family: "Songti SC", "STSong", serif;
  font-size: 19px;
}

.lab-brand p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 8px;
}

.lab-header > strong {
  justify-self: end;
  color: var(--teal);
  font-size: 10px;
}

.lab-workspace {
  min-height: calc(100vh - 131px);
  display: grid;
  grid-template-columns: minmax(410px, 0.82fr) minmax(0, 1.55fr);
}

.role-pane {
  border-right: 1px solid var(--line);
  background: #f8f7f3;
}

.role-section,
.hand-lab,
.goal-lab,
.diagnosis-lab,
.probability-lab,
.history-lab {
  padding: 24px 28px;
}

.section-heading {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.section-heading > span {
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
}

.section-heading h2 {
  margin: 0;
  font-family: "Songti SC", "STSong", serif;
  font-size: 19px;
}

.section-heading > strong {
  color: var(--muted);
  font-size: 9px;
}

.section-heading > button {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: var(--paper);
  cursor: pointer;
  font-size: 9px;
}

.role-workflow {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 8px;
  align-items: center;
}

.role-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 4px;
}

.role-mode-switch button {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 0;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 9px;
}

.role-mode-switch button + button {
  border-left: 1px solid var(--line);
}

.role-mode-switch button.active {
  color: white;
  background: var(--ink);
}

.role-view-controls {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.role-view-controls label {
  height: 34px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
}

.role-view-controls label > svg {
  justify-self: center;
  color: var(--muted);
}

.role-view-controls select {
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 9px;
}

.role-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 10px;
}

.role-actions button {
  min-width: 0;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 9px;
  text-align: left;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.role-actions button small {
  margin-left: auto;
  color: var(--muted);
  font-size: 8px;
  white-space: nowrap;
}

.role-actions button i,
.card-role-list i,
.opening-hand article div i,
.sixth-draw > div i,
.hand-summary i,
.probability-role i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
}

.role-actions button.active {
  border-color: var(--role-color);
  color: var(--ink);
  background: color-mix(in srgb, var(--role-color) 10%, var(--paper));
  box-shadow: inset 3px 0 var(--role-color);
}

.role-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.batch-selection {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  padding: 4px 5px 4px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--paper);
}

.batch-selection > strong {
  color: var(--teal);
  font-size: 9px;
}

.batch-selection > div {
  display: flex;
  gap: 4px;
}

.batch-selection button {
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: #f8f7f3;
  cursor: pointer;
  font-size: 8px;
}

.custom-role-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px 32px;
  gap: 5px;
  margin-top: 9px;
}

.custom-role-form label {
  height: 32px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding-left: 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
}

.custom-role-form label span {
  color: var(--muted);
  font-size: 8px;
}

.custom-role-form label input {
  min-width: 0;
  height: 100%;
  padding: 0 7px;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 9px;
}

.custom-role-form > input {
  width: 34px;
  height: 32px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
}

.custom-role-form > button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: var(--paper);
  cursor: pointer;
}

.custom-role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}

.custom-role-list > span {
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-left: 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--paper);
  font-size: 8px;
}

.custom-role-list i {
  width: 7px;
  height: 7px;
}

.custom-role-list button {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.role-notice {
  min-height: 15px;
  margin: 10px 0 0;
  color: var(--teal);
  font-size: 9px;
}

.role-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 8px;
  margin-top: 14px;
}

.role-card-grid article {
  min-width: 0;
  padding: 5px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.role-card-grid article.selected {
  border-color: var(--teal);
  background: #eaf1ed;
}

.role-card-grid article.role-active {
  border-color: var(--active-role-color);
  background: color-mix(
    in srgb,
    var(--active-role-color) 8%,
    transparent
  );
}

.card-select {
  position: relative;
  width: 100%;
  aspect-ratio: 59 / 86;
  display: block;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 3px;
  background: #e3e0d9;
  cursor: pointer;
}

.card-select > :deep(img),
.card-select > :deep(.card-miniature) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.card-select > strong {
  position: absolute;
  right: 3px;
  top: 3px;
  padding: 2px 4px;
  color: white;
  background: rgba(22, 23, 21, 0.88);
  font-size: 8px;
}

.selection-mark {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  color: var(--active-role-color, var(--teal));
  background: rgba(255, 254, 250, 0.92);
  font-size: 13px;
}

.selection-mark.marked {
  color: white;
  background: var(--active-role-color);
}

.card-identity {
  min-width: 0;
  margin-top: 5px;
}

.card-identity b,
.card-identity small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-identity b {
  font-size: 9px;
}

.card-identity small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 7px;
}

.card-role-list {
  min-height: 18px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}

.card-role-list .card-role-tag {
  min-width: 0;
  height: 16px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--role-color) 35%, var(--line));
  border-radius: 2px;
  color: var(--ink);
  background: var(--paper);
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-role-list .card-role-empty {
  color: var(--muted);
  font-size: 7px;
}

.role-empty,
.hand-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 10px;
}

.simulation-pane {
  min-width: 0;
}

.hand-lab {
  min-height: 490px;
  border-bottom: 1px solid var(--line);
}

.draw-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line);
  border-radius: 3px;
  overflow: hidden;
}

.draw-mode button {
  height: 30px;
  padding: 0 12px;
  border: 0;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 9px;
}

.draw-mode button + button {
  border-left: 1px solid var(--line);
}

.draw-mode button.active {
  color: white;
  background: var(--ink);
}

.hand-actions {
  display: flex;
  gap: 4px;
}

.hand-actions button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: var(--paper);
  cursor: pointer;
  font-size: 14px;
}

.hand-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hand-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 126px;
  gap: 22px;
  align-items: start;
}

.opening-hand {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
}

.opening-hand article,
.sixth-draw {
  min-width: 0;
}

.hand-card-visual {
  position: relative;
}

.opening-hand article :deep(img),
.sixth-draw :deep(img) {
  width: 100%;
  aspect-ratio: 59 / 86;
  display: block;
  object-fit: cover;
  border: 1px solid var(--line);
}

.opening-hand article.locked :deep(img),
.sixth-draw.locked :deep(img) {
  border-color: var(--teal);
  box-shadow: 0 0 0 2px rgba(40, 94, 88, 0.16);
}

.hand-card-actions {
  position: absolute;
  right: 4px;
  bottom: 4px;
  display: flex;
  gap: 3px;
}

.hand-card-actions button {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 3px;
  color: white;
  background: rgba(25, 27, 25, 0.78);
  cursor: pointer;
  font-size: 12px;
}

.hand-card-actions button.active {
  color: white;
  background: var(--teal);
}

.opening-hand article > span,
.sixth-draw > b {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hand-role-list {
  min-height: 9px;
  display: flex;
  gap: 3px;
  margin-top: 4px;
}

.sixth-draw {
  padding-left: 18px;
  border-left: 1px solid var(--line);
}

.sixth-draw header {
  height: 26px;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
}

.sixth-draw header span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  color: white;
  background: var(--accent);
  font-size: 9px;
  font-weight: 800;
}

.sixth-draw header strong {
  font-size: 9px;
}

.hand-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.hand-summary span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 9px;
}

.trial-judgement {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 12px;
}

.trial-judgement button {
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 9px;
}

.trial-judgement button.active {
  border-color: var(--teal);
  color: white;
  background: var(--teal);
}

.trial-judgement button:nth-child(2).active {
  border-color: var(--accent);
  background: var(--accent);
}

.trial-judgement button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.trial-judgement > span {
  margin-left: auto;
  color: var(--muted);
  font-size: 8px;
}

.goal-lab,
.diagnosis-lab,
.probability-lab {
  border-bottom: 1px solid var(--line);
}

.goal-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.goal-tabs button {
  min-width: 86px;
  height: 30px;
  padding: 0 10px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--muted);
  background: var(--paper);
  cursor: pointer;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-tabs button.active {
  border-color: var(--ink);
  color: white;
  background: var(--ink);
}

.goal-editor {
  padding: 14px;
  border-top: 1px solid var(--line);
  background: var(--paper);
}

.goal-title-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto 32px;
  gap: 6px;
}

.goal-title-row > input,
.goal-condition select,
.goal-condition input {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: white;
  font-size: 9px;
}

.goal-title-row > button,
.goal-condition button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--accent);
  background: white;
  cursor: pointer;
}

.goal-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line);
  border-radius: 3px;
  overflow: hidden;
}

.goal-mode button {
  height: 30px;
  padding: 0 10px;
  border: 0;
  color: var(--muted);
  background: white;
  cursor: pointer;
  font-size: 9px;
}

.goal-mode button + button {
  border-left: 1px solid var(--line);
}

.goal-mode button.active {
  color: white;
  background: var(--teal);
}

.goal-conditions {
  display: grid;
  gap: 5px;
  margin-top: 10px;
}

.goal-condition {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) 70px 58px 16px 32px;
  align-items: center;
  gap: 5px;
}

.goal-condition > span {
  color: var(--muted);
  font-size: 9px;
}

.goal-condition input {
  text-align: center;
}

.goal-condition button:disabled {
  opacity: 0.35;
}

.add-condition {
  height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--teal);
  background: white;
  cursor: pointer;
  font-size: 9px;
}

.goal-result,
.history-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 14px;
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.goal-result > span,
.history-stats > span {
  min-width: 0;
  padding: 10px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.goal-result small,
.goal-result strong,
.history-stats small,
.history-stats strong {
  display: block;
}

.goal-result small,
.history-stats small {
  color: var(--muted);
  font-size: 8px;
}

.goal-result strong,
.history-stats strong {
  margin-top: 4px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.goal-result strong.negative {
  color: var(--accent);
}

.goal-empty,
.history-empty {
  min-height: 80px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 9px;
}

.diagnosis-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.diagnosis-summary > span {
  min-width: 0;
  padding: 10px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.diagnosis-summary small,
.diagnosis-summary strong {
  display: block;
}

.diagnosis-summary small {
  color: var(--muted);
  font-size: 8px;
}

.diagnosis-summary strong {
  margin-top: 4px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.diagnosis-list {
  margin-top: 10px;
}

.diagnosis-list article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border-bottom: 1px solid var(--line);
  font-size: 9px;
}

.diagnosis-list article > strong {
  color: var(--muted);
  text-align: right;
}

.diagnosis-list article > div {
  grid-column: 1 / -1;
  height: 2px;
  margin-top: -8px;
  background: #e5e2da;
}

.diagnosis-list article i {
  height: 100%;
  display: block;
  background: var(--accent);
}

.probability-lab {
  padding-bottom: 34px;
}

.probability-head,
.probability-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 60px 100px minmax(190px, 1.2fr);
  align-items: center;
  gap: 12px;
}

.probability-head {
  padding: 0 14px 8px;
  color: var(--muted);
  font-size: 8px;
}

.probability-row {
  position: relative;
  min-height: 82px;
  padding: 9px 14px 25px;
  overflow: hidden;
  border-top: 1px solid var(--line);
  background: var(--paper);
}

.probability-role {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.probability-role strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.probability-row > b,
.probability-row > strong {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.probability-row > b {
  color: var(--muted);
}

.probability-row small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 8px;
  font-weight: 500;
}

.role-distribution {
  grid-column: 1 / -1;
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-size: 7px;
}

.role-distribution span {
  white-space: nowrap;
}

.probability-meter {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: #e5e2da;
}

.probability-meter i {
  height: 100%;
  display: block;
}

.history-lab {
  padding-bottom: 42px;
}

.history-stats {
  margin-top: 0;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 10px;
}

.history-list button {
  min-width: 0;
  min-height: 44px;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 45px;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  background: var(--paper);
  cursor: pointer;
  text-align: left;
}

.history-list button.active {
  border-color: var(--teal);
}

.history-list button.hit {
  box-shadow: inset 3px 0 var(--teal);
}

.history-list button.brick {
  box-shadow: inset 3px 0 var(--accent);
}

.history-list span,
.history-list small {
  color: var(--muted);
  font-size: 8px;
}

.history-list strong {
  min-width: 0;
  overflow: hidden;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-list small {
  text-align: right;
}

.empty-workspace {
  min-height: calc(100vh - 131px);
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: var(--muted);
}

.project-sync-warning {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 6px 16px;
  border-bottom: 1px solid #d6a49a;
  color: #743226;
  background: #f8e8e3;
  font-size: 10px;
}

.project-sync-warning button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 3px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.empty-workspace > svg {
  font-size: 34px;
}

.empty-workspace a {
  color: var(--teal);
}

@media (max-width: 1020px) {
  .lab-workspace {
    grid-template-columns: 1fr;
  }

  .role-pane {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .role-card-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .lab-header {
    height: 58px;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    padding: 0 14px;
  }

  .back-link span,
  .lab-brand p {
    display: none;
  }

  .lab-brand {
    justify-self: start;
  }

  .lab-brand > span {
    width: 30px;
    height: 30px;
  }

  .lab-brand h1 {
    font-size: 15px;
  }

  .role-section,
  .hand-lab,
  .goal-lab,
  .diagnosis-lab,
  .probability-lab,
  .history-lab {
    padding: 20px 14px;
  }

  .section-heading {
    grid-template-columns: 24px minmax(0, 1fr) auto;
  }

  .role-workflow {
    grid-template-columns: 1fr;
  }

  .hand-lab .hand-actions {
    grid-column: 3;
    grid-row: 1;
  }

  .draw-mode {
    grid-column: 2 / -1;
    grid-row: 2;
  }

  .role-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .hand-board {
    grid-template-columns: 1fr;
  }

  .opening-hand {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }

  .sixth-draw {
    width: 92px;
    padding: 12px 0 0;
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .probability-head,
  .probability-row {
    grid-template-columns: minmax(70px, 1fr) 42px 70px minmax(126px, 1.2fr);
    gap: 6px;
  }

  .probability-row {
    padding-right: 8px;
    padding-left: 8px;
  }

  .probability-row > b,
  .probability-row > strong {
    font-size: 10px;
  }

  .role-distribution {
    gap: 7px;
  }

  .history-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 390px) {
  .role-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .probability-head,
  .probability-row {
    grid-template-columns: 62px 34px 58px minmax(116px, 1fr);
  }

  .goal-title-row {
    grid-template-columns: minmax(90px, 1fr) auto 32px;
  }

  .goal-mode button {
    padding: 0 6px;
  }

  .goal-condition {
    grid-template-columns: minmax(68px, 1fr) 62px 48px 12px 30px;
    gap: 3px;
  }

  .goal-result > span,
  .history-stats > span {
    padding: 8px 5px;
  }

  .goal-result strong,
  .history-stats strong {
    font-size: 11px;
  }
}
</style>
