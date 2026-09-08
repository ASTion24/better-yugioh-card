<template>
  <div :class="['card-studio', { 'has-deck-context': hasWritebackContext }]">
    <header class="studio-header">
      <a class="studio-brand" href="../">
        <span class="brand-seal">YG</span>
        <div>
          <strong>单卡DIY工坊</strong>
          <span>CARD STUDIO</span>
        </div>
      </a>

      <div class="document-title">
        <span>{{ activePreset.title }}</span>
        <small>{{ form.data.name || '未命名卡片' }}</small>
      </div>

      <nav class="header-actions" aria-label="编辑器操作">
        <button
          type="button"
          title="撤销"
          :disabled="!canUndo"
          @click="undo"
        >
          <Icon icon="ri:arrow-go-back-line" />
        </button>
        <button
          type="button"
          title="重做"
          :disabled="!canRedo"
          @click="redo"
        >
          <Icon icon="ri:arrow-go-forward-line" />
        </button>
        <button type="button" title="恢复示例" @click="resetCard">
          <Icon icon="ri:restart-line" />
        </button>
        <span class="action-divider" />
        <a href="../library/" title="卡片资料库">
          <Icon icon="ri:archive-drawer-line" />
          <span>卡片库</span>
        </a>
        <a href="../print/" title="卡组打印工作台">
          <Icon icon="ri:printer-line" />
          <span>卡组打印</span>
        </a>
        <a href="../batch/" title="批量制卡">
          <Icon icon="ri:stack-line" />
          <span>批量制卡</span>
        </a>
        <button type="button" title="加入当前批量制卡方案" @click="addCurrentToBatch">
          <Icon icon="ri:folder-transfer-line" />
          <span>加入批量</span>
        </button>
        <button type="button" title="GitHub" @click="toGithub">
          <Icon icon="ri:github-fill" />
        </button>
        <button
          class="export-command"
          type="button"
          :disabled="isExporting"
          @click="exportImage"
        >
          <Icon :icon="isExporting ? 'ri:loader-4-line' : 'ri:download-2-line'" :class="{ spinning: isExporting }" />
          <span>{{ isExporting ? '导出中' : '导出 PNG' }}</span>
        </button>
      </nav>
    </header>

    <ProjectBar
      class="studio-project-bar"
      :project-id="activeProjectId"
      :name="projectName"
      name-placeholder="单卡草稿名称"
      entity-label="单卡草稿"
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

    <div v-if="hasWritebackContext" class="deck-writeback-bar">
      <span>
        <Icon :icon="hasBatchContext ? 'ri:stack-line' : 'ri:layout-grid-line'" />
        {{ writebackLabel }}
      </span>
      <div>
        <button type="button" :disabled="isWritingBack" @click="writeBackToSource('add')">
          <Icon icon="ri:add-line" />
          <span>{{ hasBatchContext ? '作为副本加入' : '作为新卡加入' }}</span>
        </button>
        <button
          class="primary"
          type="button"
          :disabled="isWritingBack"
          @click="writeBackToSource('replace')"
        >
          <Icon :icon="isWritingBack ? 'ri:loader-4-line' : 'ri:save-3-line'" :class="{ spinning: isWritingBack }" />
          <span>替换原卡并返回</span>
        </button>
      </div>
    </div>

    <main class="studio-workspace">
      <section ref="previewPanel" class="preview-panel">
        <div class="preview-meta">
          <div>
            <span class="meta-label">LIVE CANVAS</span>
            <strong>{{ cardDimensions }}</strong>
          </div>
          <span :class="['render-state', { error: renderError }]">
            {{ renderError || renderState }}
          </span>
        </div>

        <div class="preview-stage">
          <div class="registration-mark top-left" />
          <div class="registration-mark bottom-right" />
          <div class="preview-shell" :style="previewShellStyle">
            <div ref="card" class="card-canvas" :style="cardCanvasStyle" />
          </div>
        </div>

        <div class="preview-tools">
          <button type="button" title="缩小预览" @click="adjustZoom(-0.1)">
            <Icon icon="ri:zoom-out-line" />
          </button>
          <button type="button" title="适应窗口" @click="resetZoom">
            <Icon icon="ri:focus-3-line" />
          </button>
          <button type="button" title="放大预览" @click="adjustZoom(0.1)">
            <Icon icon="ri:zoom-in-line" />
          </button>
          <output>{{ zoomPercent }}%</output>
        </div>
      </section>

      <aside class="inspector">
        <div class="template-picker">
          <button
            v-for="preset in cardPresets"
            :key="preset.key"
            type="button"
            :class="{ active: form.card === preset.key }"
            @click="selectCardKind(preset.key)"
          >
            <Icon :icon="preset.icon" />
            <span>{{ preset.shortTitle }}</span>
          </button>
        </div>

        <div class="inspector-tabs" role="tablist">
          <button
            v-for="tab in availableTabs"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <Icon :icon="tab.icon" />
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <div class="inspector-content">
          <section v-if="activeTab === 'card'" class="editor-section">
            <div class="section-title">
              <span>01</span>
              <h2>卡片信息</h2>
            </div>

            <div v-if="isYugioh" class="database-lookup">
              <form class="database-search" @submit.prevent="searchDatabase">
                <Icon icon="ri:database-2-line" />
                <input
                  v-model="databaseQuery"
                  type="search"
                  placeholder="卡片密码或名称（含先行卡）"
                  aria-label="卡片数据库搜索"
                  @input="databaseNotice = ''"
                  @keydown.esc="databaseResults = []"
                >
                <button type="submit" :disabled="databaseSearching">
                  <Icon :icon="databaseSearching ? 'ri:loader-4-line' : 'ri:search-line'" :class="{ spinning: databaseSearching }" />
                  <span>匹配</span>
                </button>
              </form>
              <div v-if="databaseResults.length" class="database-results">
                <button
                  v-for="result in databaseResults"
                  :key="`${result.id}-${result.artid || 0}`"
                  type="button"
                  @click="applyDatabaseResult(result)"
                >
                  <CardThumbnail
                    :card-id="getDatabaseCardId(result)"
                    quality="medium"
                    language="sc"
                    alt=""
                  />
                  <span>
                    <strong>{{ getDatabaseCardName(result) }}</strong>
                    <small>{{ getDatabaseCardId(result) }} · {{ getDatabaseCardType(result) }}</small>
                  </span>
                  <Icon icon="ri:add-line" />
                </button>
              </div>
              <p v-if="databaseError" class="database-message error">{{ databaseError }}</p>
              <p v-else-if="databaseNotice" class="database-message">{{ databaseNotice }}</p>
              <div v-if="sourceCardId" class="source-refresh">
                <span>来源 {{ sourceCardId }}</span>
                <button
                  type="button"
                  :disabled="checkingSource"
                  @click="checkSourceUpdates"
                >
                  <Icon :icon="checkingSource ? 'ri:loader-4-line' : 'ri:refresh-line'" :class="{ spinning: checkingSource }" />
                  <span>检查更新</span>
                </button>
              </div>
              <div v-if="sourceDiff.length" class="source-diff">
                <label v-for="item in sourceDiff" :key="item.key">
                  <input v-model="item.selected" type="checkbox">
                  <span>{{ item.label }}</span>
                  <small>{{ item.summary }}</small>
                </label>
                <footer>
                  <button type="button" @click="sourceDiff = []">取消</button>
                  <button class="primary" type="button" @click="applySourceUpdates">
                    应用所选更新
                  </button>
                </footer>
              </div>
            </div>

            <template v-if="isBackCard">
              <label class="field">
                <span>背面样式</span>
                <select v-model="form.data.type">
                  <option value="normal">标准背面</option>
                  <option value="sky-dragon">天空龙</option>
                  <option value="tormentor">巨神兵</option>
                  <option value="winged-dragon">翼神龙</option>
                </select>
              </label>
              <label class="field">
                <span>标志</span>
                <select v-model="form.data.logo">
                  <option value="">无</option>
                  <option value="ocg">OCG</option>
                  <option value="tcg">TCG</option>
                  <option value="rd">Rush Duel</option>
                </select>
              </label>
              <label class="switch-field">
                <input v-model="form.data.konami" type="checkbox">
                <span>KONAMI 标志</span>
              </label>
              <label class="switch-field">
                <input v-model="form.data.register" type="checkbox">
                <span>注册商标</span>
              </label>
            </template>

            <template v-else-if="isFieldCenter">
              <label class="switch-field">
                <input v-model="form.data.cardBack" type="checkbox">
                <span>显示卡背</span>
              </label>
              <label class="switch-field">
                <input v-model="form.data.radius" type="checkbox">
                <span>圆角裁切</span>
              </label>
            </template>

            <template v-else>
              <label class="field field-wide">
                <span>卡片名称</span>
                <input v-model="form.data.name" type="text">
              </label>

              <div class="field-grid">
                <label class="field">
                  <span>语言</span>
                  <select v-model="form.data.language">
                    <option v-for="option in languageOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span>卡片类别</span>
                  <select v-model="form.data.type">
                    <option value="monster">怪兽</option>
                    <option v-if="supportsPendulum" value="pendulum">灵摆</option>
                    <option value="spell">魔法</option>
                    <option value="trap">陷阱</option>
                  </select>
                </label>
              </div>

              <div class="field-grid">
                <label v-if="isMonster" class="field">
                  <span>怪兽类型</span>
                  <select v-model="form.data.cardType">
                    <option
                      v-for="option in monsterCardTypeOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label v-if="isMonster" class="field">
                  <span>属性</span>
                  <select v-model="form.data.attribute">
                    <option v-for="option in attributeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label v-else class="field field-wide">
                  <span>魔陷标识</span>
                  <select v-model="form.data.icon">
                    <option v-for="option in iconOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>

              <template v-if="isMonster">
                <label class="field field-wide">
                  <span>种族 / 分类</span>
                  <input v-model="form.data.monsterType" type="text">
                </label>

                <div class="number-grid">
                  <label v-if="showLevel" class="number-field">
                    <span>等级</span>
                    <input
                      v-model.number="form.data.level"
                      type="number"
                      min="0"
                      max="13"
                    >
                  </label>
                  <label v-if="showRank" class="number-field">
                    <span>阶级</span>
                    <input
                      v-model.number="form.data.rank"
                      type="number"
                      min="0"
                      max="13"
                    >
                  </label>
                  <label v-if="isPendulum" class="number-field">
                    <span>刻度</span>
                    <input
                      v-model.number="form.data.pendulumScale"
                      type="number"
                      min="0"
                      max="13"
                    >
                  </label>
                  <label class="number-field">
                    <span>ATK</span>
                    <input v-model.number="form.data.atk" type="number">
                  </label>
                  <label v-if="!isLink" class="number-field">
                    <span>DEF</span>
                    <input v-model.number="form.data.def" type="number">
                  </label>
                  <label v-if="isRush" class="number-field">
                    <span>MAXIMUM</span>
                    <input v-model.number="form.data.maximumAtk" type="number">
                  </label>
                </div>

                <div v-if="isLink" class="arrow-field">
                  <span>连接箭头</span>
                  <div class="arrow-grid">
                    <button
                      v-for="arrow in arrowOptions"
                      :key="arrow.value || 'center'"
                      type="button"
                      :disabled="!arrow.value"
                      :class="{ active: arrow.value && form.data.arrowList.includes(arrow.value) }"
                      :title="arrow.label"
                      @click="arrow.value && toggleArrow(arrow.value)"
                    >
                      <Icon v-if="arrow.value" icon="ri:arrow-up-line" :style="{ transform: `rotate(${arrow.rotation}deg)` }" />
                      <span v-else />
                    </button>
                  </div>
                </div>
              </template>
            </template>
          </section>

          <section v-else-if="activeTab === 'art'" class="editor-section">
            <div class="section-title">
              <span>02</span>
              <h2>{{ isBackCard ? '卡背设置' : '卡图素材' }}</h2>
            </div>

            <template v-if="supportsImage">
              <div class="art-preview">
                <img v-if="form.data.image" :src="form.data.image" alt="当前卡图">
                <div v-else class="art-empty">
                  <Icon icon="ri:image-add-line" />
                </div>
                <div class="art-actions">
                  <button type="button" @click="imageInput?.click()">
                    <Icon icon="ri:upload-2-line" />
                    <span>上传图片</span>
                  </button>
                  <button
                    type="button"
                    title="移除图片"
                    :disabled="!form.data.image"
                    @click="removeImage"
                  >
                    <Icon icon="ri:delete-bin-line" />
                  </button>
                </div>
              </div>
              <input
                ref="imageInput"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                @change="onImageFile"
              >
              <label class="field field-wide">
                <span>图片地址</span>
                <input v-model="form.data.image" type="url" placeholder="https://">
              </label>
            </template>

            <label class="switch-field">
              <input v-model="form.data.radius" type="checkbox">
              <span>圆角裁切</span>
            </label>
            <label v-if="isFieldCenter" class="switch-field">
              <input v-model="form.data.cardBack" type="checkbox">
              <span>显示卡背</span>
            </label>
          </section>

          <section v-else-if="activeTab === 'text'" class="editor-section">
            <div class="section-title">
              <span>03</span>
              <h2>文字内容</h2>
            </div>

            <label v-if="isPendulum" class="field field-wide">
              <span>灵摆效果</span>
              <textarea v-model="form.data.pendulumDescription" rows="5" />
            </label>
            <label class="field field-wide">
              <span>{{ form.data.cardType === 'normal' ? '描述文字' : '卡片效果' }}</span>
              <textarea v-model="form.data.description" rows="9" />
            </label>

            <label class="range-field">
              <span>文字缩放</span>
              <input
                v-model.number="form.data.descriptionZoom"
                type="range"
                min="0.6"
                max="1.35"
                step="0.05"
              >
              <output>{{ Number(form.data.descriptionZoom || 1).toFixed(2) }}</output>
            </label>
            <label class="switch-field">
              <input v-model="form.data.firstLineCompress" type="checkbox">
              <span>首行压缩</span>
            </label>
            <label class="switch-field">
              <input v-model="form.data.descriptionAlign" type="checkbox">
              <span>文字居中</span>
            </label>

            <div class="field-grid metadata-grid">
              <label class="field">
                <span>卡包编号</span>
                <input v-model="form.data.package" type="text">
              </label>
              <label class="field">
                <span>卡片密码</span>
                <input v-model="form.data.password" type="text">
              </label>
            </div>
            <label v-if="isStandard" class="field field-wide">
              <span>版权文字</span>
              <input v-model="form.data.copyright" type="text">
            </label>
          </section>

          <section v-else-if="activeTab === 'finish'" class="editor-section">
            <div class="section-title">
              <span>04</span>
              <h2>装帧效果</h2>
            </div>

            <div class="field">
              <span>名称颜色</span>
              <div class="color-controls">
                <button
                  v-for="color in nameColorOptions"
                  :key="color"
                  type="button"
                  class="color-swatch"
                  :class="{ active: form.data.color === color }"
                  :style="{ backgroundColor: color }"
                  :aria-label="color"
                  @click="form.data.color = color"
                />
                <label class="color-picker" title="自定义颜色">
                  <Icon icon="ri:palette-line" />
                  <input v-model="form.data.color" type="color">
                </label>
                <button class="clear-color" type="button" @click="form.data.color = ''">自动</button>
              </div>
            </div>

            <div v-if="isStandard" class="alignment-switch">
              <span>名称对齐</span>
              <div>
                <button type="button" :class="{ active: form.data.align === 'left' }" @click="form.data.align = 'left'">
                  <Icon icon="ri:align-left" />
                </button>
                <button type="button" :class="{ active: form.data.align === 'center' }" @click="form.data.align = 'center'">
                  <Icon icon="ri:align-center" />
                </button>
                <button type="button" :class="{ active: form.data.align === 'right' }" @click="form.data.align = 'right'">
                  <Icon icon="ri:align-right" />
                </button>
              </div>
            </div>

            <label v-if="isStandard" class="switch-field">
              <input v-model="form.data.gradient" type="checkbox">
              <span>名称渐变</span>
            </label>
            <div v-if="isStandard && form.data.gradient" class="gradient-colors">
              <label>
                <span>起始</span>
                <input v-model="form.data.gradientColor1" type="color">
              </label>
              <label>
                <span>结束</span>
                <input v-model="form.data.gradientColor2" type="color">
              </label>
            </div>

            <div class="field-grid rarity-grid">
              <label class="field">
                <span>罕贵效果</span>
                <select v-model="form.data.rare">
                  <option v-for="option in rareOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label class="field">
                <span>镭射膜</span>
                <select v-model="form.data.laser">
                  <option value="">无</option>
                  <option value="laser1">镭射 1</option>
                  <option value="laser2">镭射 2</option>
                  <option value="laser3">镭射 3</option>
                  <option value="laser4">镭射 4</option>
                </select>
              </label>
            </div>

            <label v-if="isYugioh" class="switch-field">
              <input v-model="form.data.atkBar" type="checkbox">
              <span>显示攻击栏</span>
            </label>
            <label v-if="isYugioh" class="switch-field">
              <input v-model="form.data.twentieth" type="checkbox">
              <span>二十周年标记</span>
            </label>
            <label v-if="isRush" class="switch-field">
              <input v-model="form.data.legend" type="checkbox">
              <span>LEGEND 标记</span>
            </label>
          </section>
        </div>
      </aside>
    </main>
    <ImageCropper
      v-if="cropSource"
      :source="cropSource"
      @apply="applyCroppedImage"
      @cancel="cropSource = ''"
    />
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  toRaw,
  watch,
} from 'vue';
import { YugiohCard } from 'yugioh-card/src/yugioh-card/index';
import CardThumbnail from './CardThumbnail.vue';
import ImageCropper from './ImageCropper.vue';
import ProjectBar from './ProjectBar.vue';
import { CARD_RESOURCE_PATH } from '@/config/card-resources';
import {
  appendBatchCards,
  createBatchCard,
  writeBatchCard,
} from '@/features/batch/batch-project';
import { resolveSearchResult } from '@/features/cards/card-service';
import {
  createCustomCard,
  getCustomCard,
  isCustomCardId,
  writeCustomCardToDeck,
} from '@/features/cards/custom-card';
import {
  isExtraDeckCardType,
} from '@/features/print/card-adapter';
import {
  getCardArtworkId,
  searchCardDatabase as queryCardDatabase,
} from '@/features/print/card-source';
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
} from '@/features/projects/project-store';
import yugiohDemo from '@/assets/demo/yugioh-demo';

const cardPresets = [
  { key: 'yugioh', title: '游戏王标准卡', shortTitle: '标准', icon: 'ri:stack-line', Card: YugiohCard, demo: yugiohDemo },
  {
    key: 'rush-duel',
    title: 'Rush Duel',
    shortTitle: 'Rush',
    icon: 'ri:flashlight-line',
    load: async () => {
      const [{ RushDuelCard }, { default: demo }] = await Promise.all([
        import('yugioh-card/src/rush-duel-card/index'),
        import('@/assets/demo/rush-duel-demo'),
      ]);
      return { Card: RushDuelCard, demo };
    },
  },
  {
    key: 'yugioh-series-2',
    title: '游戏王二期卡',
    shortTitle: '二期',
    icon: 'ri:archive-drawer-line',
    load: async () => {
      const [{ YugiohSeries2Card }, { default: demo }] = await Promise.all([
        import('yugioh-card/src/yugioh-series-2-card/index'),
        import('@/assets/demo/yugioh-series-2-demo'),
      ]);
      return { Card: YugiohSeries2Card, demo };
    },
  },
  {
    key: 'yugioh-back',
    title: '游戏王卡背',
    shortTitle: '卡背',
    icon: 'ri:contrast-2-line',
    load: async () => {
      const [{ YugiohBackCard }, { default: demo }] = await Promise.all([
        import('yugioh-card/src/yugioh-back-card/index'),
        import('@/assets/demo/yugioh-back-demo'),
      ]);
      return { Card: YugiohBackCard, demo };
    },
  },
  {
    key: 'field-center',
    title: '场地中心卡',
    shortTitle: '场地',
    icon: 'ri:layout-grid-line',
    load: async () => {
      const [{ FieldCenterCard }, { default: demo }] = await Promise.all([
        import('yugioh-card/src/field-center-card/index'),
        import('@/assets/demo/field-center-demo'),
      ]);
      return { Card: FieldCenterCard, demo };
    },
  },
];

const allTabs = [
  { key: 'card', label: '卡片', icon: 'ri:id-card-line' },
  { key: 'art', label: '卡图', icon: 'ri:image-line' },
  { key: 'text', label: '文字', icon: 'ri:text' },
  { key: 'finish', label: '装帧', icon: 'ri:sparkling-line' },
];

const commonLanguageOptions = [
  { value: 'sc', label: '简体中文' },
  { value: 'tc', label: '繁体中文' },
  { value: 'jp', label: '日文' },
  { value: 'kr', label: '韩文' },
  { value: 'en', label: '英文' },
  { value: 'astral', label: '星光体文字' },
];

const attributeOptions = [
  { value: 'dark', label: '暗' },
  { value: 'light', label: '光' },
  { value: 'earth', label: '地' },
  { value: 'water', label: '水' },
  { value: 'fire', label: '炎' },
  { value: 'wind', label: '风' },
  { value: 'divine', label: '神' },
];

const iconOptions = [
  { value: '', label: '无' },
  { value: 'continuous', label: '永续' },
  { value: 'equip', label: '装备' },
  { value: 'field', label: '场地' },
  { value: 'quick-play', label: '速攻' },
  { value: 'ritual', label: '仪式' },
  { value: 'counter', label: '反击' },
];

const standardMonsterTypes = [
  { value: 'normal', label: '通常' },
  { value: 'effect', label: '效果' },
  { value: 'ritual', label: '仪式' },
  { value: 'fusion', label: '融合' },
  { value: 'synchro', label: '同调' },
  { value: 'xyz', label: '超量' },
  { value: 'link', label: '连接' },
  { value: 'token', label: '衍生物' },
];

const rushMonsterTypes = standardMonsterTypes.filter(option => {
  return ['normal', 'effect', 'ritual', 'fusion'].includes(option.value);
});

const rareOptionsStandard = [
  { value: '', label: '无' },
  { value: 'ur', label: '金字 UR' },
  { value: 'ser', label: '银碎 SER' },
  { value: 'gser', label: '金碎 GSER' },
  { value: 'gr', label: '黄金 GR' },
  { value: 'dt', label: 'DT 斑点' },
  { value: 'pser', label: '棱碎 PSER' },
  { value: 'pser-print', label: '印刷棱碎' },
  { value: 'hr', label: '全息 HR' },
];

const rareOptionsRush = [
  { value: '', label: '无' },
  { value: 'sr', label: '面闪 SR' },
  { value: 'rr', label: 'Rush Rare' },
  { value: 'pser', label: '棱碎 PSER' },
];

const arrowOptions = [
  { value: 8, label: '左上', rotation: -45 },
  { value: 1, label: '上', rotation: 0 },
  { value: 2, label: '右上', rotation: 45 },
  { value: 7, label: '左', rotation: -90 },
  { value: 0, label: '', rotation: 0 },
  { value: 3, label: '右', rotation: 90 },
  { value: 6, label: '左下', rotation: -135 },
  { value: 5, label: '下', rotation: 180 },
  { value: 4, label: '右下', rotation: 135 },
];

const nameColorOptions = ['#111111', '#ffffff', '#c7a14a', '#b7272e', '#315f91'];
const cloneData = value => JSON.parse(JSON.stringify(value));

const card = ref(null);
const previewPanel = ref(null);
const imageInput = ref(null);
const cardLeaf = shallowRef(null);
const activeTab = ref('card');
const isExporting = ref(false);
const renderState = ref('准备就绪');
const renderError = ref('');
const cropSource = ref('');
const databaseQuery = ref('');
const databaseResults = ref([]);
const databaseSearching = ref(false);
const databaseError = ref('');
const databaseNotice = ref('');
const fitScale = ref(1);
const zoom = ref(1);
const displaySize = reactive({ width: 697, height: 1016 });
const history = ref([]);
const historyIndex = ref(-1);
const applyingHistory = ref(false);
const form = reactive({
  card: 'yugioh',
  data: cloneData(yugiohDemo),
});
const projects = ref([]);
const activeProjectId = ref('');
const activeProjectRevision = ref(0);
const projectName = ref('未命名单卡');
const isWritingBack = ref(false);
const sourceCardId = ref('');
const checkingSource = ref(false);
const sourceDiff = ref([]);
const deckContext = reactive({
  projectId: '',
  projectName: '',
  section: 'main',
  sourceId: '',
});
const batchContext = reactive({
  projectId: '',
  projectName: '',
  sourceId: '',
});
const hasDeckContext = computed(() => Boolean(deckContext.projectId));
const hasBatchContext = computed(() => Boolean(batchContext.projectId));
const hasWritebackContext = computed(() =>
  hasDeckContext.value || hasBatchContext.value);
const deckSectionLabel = computed(() => ({
  main: '主卡组',
  extra: '额外卡组',
  side: '副卡组',
})[deckContext.section] || '主卡组');
const writebackLabel = computed(() => hasBatchContext.value
  ? `${batchContext.projectName} · 批量卡片`
  : `${deckContext.projectName} · ${deckSectionLabel.value}`);

let resizeObserver;
let renderFrame;
let renderRequest = 0;
let historyTimer;
let projectSaveTimer;
let loadingProject = false;

const activePreset = computed(() => cardPresets.find(item => item.key === form.card) || cardPresets[0]);
const isYugioh = computed(() => form.card === 'yugioh');
const isStandard = computed(() => ['yugioh', 'yugioh-series-2'].includes(form.card));
const isRush = computed(() => form.card === 'rush-duel');
const isBackCard = computed(() => form.card === 'yugioh-back');
const isFieldCenter = computed(() => form.card === 'field-center');
const supportsImage = computed(() => !isBackCard.value);
const supportsPendulum = computed(() => isYugioh.value);
const supportsText = computed(() => isStandard.value || isRush.value);
const supportsFinish = computed(() => supportsText.value);
const isMonster = computed(() => ['monster', 'pendulum'].includes(form.data.type));
const isPendulum = computed(() => form.data.type === 'pendulum');
const isLink = computed(() => form.data.cardType === 'link');
const showLevel = computed(() => isMonster.value && form.data.cardType !== 'xyz' && !isLink.value);
const showRank = computed(() => isMonster.value && form.data.cardType === 'xyz');
const languageOptions = computed(() => {
  if (isRush.value) {
    return commonLanguageOptions.filter(option => ['sc', 'jp'].includes(option.value));
  }
  if (form.card === 'yugioh-series-2') {
    return commonLanguageOptions.filter(option => option.value === 'jp');
  }
  return commonLanguageOptions;
});
const monsterCardTypeOptions = computed(() => isRush.value ? rushMonsterTypes : standardMonsterTypes);
const rareOptions = computed(() => isRush.value ? rareOptionsRush : rareOptionsStandard);
const availableTabs = computed(() => allTabs.filter(tab => {
  if (tab.key === 'text') return supportsText.value;
  if (tab.key === 'finish') return supportsFinish.value;
  return true;
}));
const cardDimensions = computed(() => `${cardLeaf.value?.cardWidth || 1394} × ${cardLeaf.value?.cardHeight || 2031} px`);
const previewScale = computed(() => fitScale.value * zoom.value);
const zoomPercent = computed(() => Math.round(zoom.value * 100));
const previewShellStyle = computed(() => ({
  width: `${displaySize.width * previewScale.value}px`,
  height: `${displaySize.height * previewScale.value}px`,
}));
const cardCanvasStyle = computed(() => ({
  width: `${displaySize.width}px`,
  height: `${displaySize.height}px`,
  transform: `scale(${previewScale.value})`,
}));
const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1);

const updatePreviewScale = () => {
  if (!previewPanel.value || !cardLeaf.value) {
    return;
  }
  const stage = previewPanel.value.querySelector('.preview-stage');
  const bounds = stage?.getBoundingClientRect();
  if (!bounds) {
    return;
  }
  const padding = window.innerWidth < 600 ? 28 : 72;
  fitScale.value = Math.min(
    Math.max(0.12, (bounds.width - padding) / displaySize.width),
    Math.max(0.12, (bounds.height - padding) / displaySize.height),
    1,
  );
};

const refreshDisplaySize = () => {
  const ratio = window.devicePixelRatio || 1;
  displaySize.width = (cardLeaf.value?.cardWidth || 1394) / ratio;
  displaySize.height = (cardLeaf.value?.cardHeight || 2031) / ratio;
  nextTick(updatePreviewScale);
};

const ensurePresetLoaded = async preset => {
  if (!preset.Card || !preset.demo) {
    Object.assign(preset, await preset.load());
  }
  return preset;
};

const createCardRenderer = async () => {
  cardLeaf.value?.destroy();
  await nextTick();
  const preset = await ensurePresetLoaded(activePreset.value);
  const CardClass = preset.Card;
  cardLeaf.value = new CardClass({
    view: card.value,
    data: cloneData(form.data),
    resourcePath: CARD_RESOURCE_PATH,
  });
  refreshDisplaySize();
  renderState.value = '加载资源';
  renderError.value = '';
  cardLeaf.value.ready()
    .then(() => {
      renderState.value = '实时预览';
    })
    .catch(error => {
      renderError.value = error instanceof Error ? error.message : String(error);
    });
};

const resetHistory = () => {
  clearTimeout(historyTimer);
  history.value = [JSON.stringify(toRaw(form.data))];
  historyIndex.value = 0;
};

const scheduleHistory = () => {
  if (applyingHistory.value) {
    return;
  }
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    const snapshot = JSON.stringify(toRaw(form.data));
    if (history.value[historyIndex.value] === snapshot) {
      return;
    }
    history.value = history.value.slice(0, historyIndex.value + 1);
    history.value.push(snapshot);
    if (history.value.length > 60) {
      history.value.shift();
    }
    historyIndex.value = history.value.length - 1;
  }, 350);
};

const applySnapshot = snapshot => {
  applyingHistory.value = true;
  form.data = JSON.parse(snapshot);
  nextTick(() => {
    applyingHistory.value = false;
  });
};

const undo = () => {
  if (!canUndo.value) return;
  historyIndex.value -= 1;
  applySnapshot(history.value[historyIndex.value]);
};

const redo = () => {
  if (!canRedo.value) return;
  historyIndex.value += 1;
  applySnapshot(history.value[historyIndex.value]);
};

const selectCardKind = async key => {
  const preset = cardPresets.find(item => item.key === key);
  if (!preset || form.card === key) {
    return;
  }
  await ensurePresetLoaded(preset);
  form.card = key;
  form.data = cloneData(preset.demo);
  activeTab.value = 'card';
  databaseQuery.value = '';
  databaseResults.value = [];
  databaseError.value = '';
  databaseNotice.value = '';
  zoom.value = 1;
  resetHistory();
  createCardRenderer();
};

const resetCard = () => {
  form.data = cloneData(activePreset.value.demo);
};

const adjustZoom = delta => {
  zoom.value = Math.min(1.6, Math.max(0.5, Number((zoom.value + delta).toFixed(1))));
};

const resetZoom = () => {
  zoom.value = 1;
};

const toggleArrow = arrow => {
  const arrows = form.data.arrowList || [];
  form.data.arrowList = arrows.includes(arrow)
    ? arrows.filter(value => value !== arrow)
    : [...arrows, arrow].sort((a, b) => a - b);
};

const getDatabaseCardName = result => {
  return result.sc_name || result.cn_name || result.md_name || result.jp_name || result.en_name || String(result.id);
};

const getDatabaseCardType = result => {
  return result.text?.types?.split('\n')[0] || '卡片';
};

const getDatabaseCardId = result => getCardArtworkId(result);
const SOURCE_FIELD_LABELS = {
  name: '卡片名称',
  type: '卡片类别',
  cardType: '怪兽类型',
  attribute: '属性',
  icon: '魔陷标识',
  level: '等级',
  rank: '阶级',
  pendulumScale: '灵摆刻度',
  monsterType: '种族 / 分类',
  atk: 'ATK',
  def: 'DEF',
  arrowList: '连接箭头',
  description: '效果文本',
  pendulumDescription: '灵摆效果',
  image: '卡图',
  password: '卡片密码',
};
const summarizeDiffValue = value => {
  if (String(value || '').startsWith('data:image/')) return '卡图已变化';
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  return text.length > 34 ? `${text.slice(0, 34)}…` : text || '空';
};

const searchDatabase = async () => {
  const keyword = databaseQuery.value.trim() ||
    String(form.data.password || '').trim() ||
    String(form.data.name || '').trim();
  if (!keyword || databaseSearching.value) {
    databaseError.value = keyword ? '' : '请输入卡片密码或名称';
    return;
  }

  databaseQuery.value = keyword;
  databaseSearching.value = true;
  databaseError.value = '';
  databaseNotice.value = '';
  try {
    const results = await queryCardDatabase(keyword);
    const normalizedPassword = keyword.replace(/^0+/, '') || '0';
    const exactPasswordMatch = /^\d+$/.test(keyword)
      ? results.find(result => {
        return getDatabaseCardId(result) === normalizedPassword ||
          String(result.id) === normalizedPassword;
      })
      : null;
    if (exactPasswordMatch) {
      await applyDatabaseResult(exactPasswordMatch);
      return;
    }
    databaseResults.value = results.slice(0, 8);
    if (!databaseResults.value.length) {
      databaseError.value = `未找到“${keyword}”`;
    }
  } catch (error) {
    databaseResults.value = [];
    databaseError.value = error instanceof Error ? error.message : String(error);
  } finally {
    databaseSearching.value = false;
  }
};

async function applyDatabaseResult(result) {
  const styleKeys = [
    'align',
    'atkBar',
    'color',
    'descriptionAlign',
    'descriptionWeight',
    'descriptionZoom',
    'gradient',
    'gradientColor1',
    'gradientColor2',
    'laser',
    'radius',
    'rare',
    'scale',
    'twentieth',
  ];
  const preservedStyle = Object.fromEntries(
    styleKeys
      .filter(key => Object.hasOwn(form.data, key))
      .map(key => [key, form.data[key]]),
  );
  databaseSearching.value = true;
  databaseResults.value = [];
  databaseError.value = '';
  databaseNotice.value = `正在获取 ${getDatabaseCardName(result)} 的卡图`;
  let resolved;
  try {
    resolved = await resolveSearchResult(result, { includeArtwork: true });
  } catch {
    databaseError.value = '卡片资料已匹配，但中心卡图获取失败';
  } finally {
    databaseSearching.value = false;
  }

  if (!resolved) {
    return;
  }
  const matchedData = resolved.rendererData;
  renderState.value = '更新预览';
  form.data = {
    ...cloneData(yugiohDemo),
    ...matchedData,
    ...preservedStyle,
  };
  sourceCardId.value = resolved.artworkId;
  databaseQuery.value = matchedData.name;
  if (!databaseError.value) {
    databaseNotice.value = resolved.alternateArtwork
      ? `已载入 ${matchedData.name} · ${resolved.artworkId}；卡组打印工作台将保留完整特殊版式`
      : `已载入 ${matchedData.name} · ${resolved.artworkId}`;
  }
}

const checkSourceUpdates = async () => {
  if (!sourceCardId.value || checkingSource.value) return;
  checkingSource.value = true;
  databaseError.value = '';
  sourceDiff.value = [];
  try {
    const results = await queryCardDatabase(sourceCardId.value);
    const target = results.find(result =>
      getDatabaseCardId(result) === sourceCardId.value ||
      String(result.id) === sourceCardId.value);
    if (!target) throw new Error('来源卡片暂不可用');
    const resolved = await resolveSearchResult(target, { includeArtwork: true });
    sourceDiff.value = Object.entries(resolved.rendererData)
      .filter(([key, value]) =>
        SOURCE_FIELD_LABELS[key] &&
        JSON.stringify(form.data[key]) !== JSON.stringify(value))
      .map(([key, value]) => ({
        key,
        label: SOURCE_FIELD_LABELS[key],
        summary: summarizeDiffValue(value),
        value,
        selected: true,
      }));
    databaseNotice.value = sourceDiff.value.length
      ? `发现 ${sourceDiff.value.length} 项资料变化`
      : '当前资料已是最新';
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
  } finally {
    checkingSource.value = false;
  }
};

const applySourceUpdates = () => {
  const updates = Object.fromEntries(
    sourceDiff.value
      .filter(item => item.selected)
      .map(item => [item.key, cloneData(item.value)]),
  );
  form.data = { ...form.data, ...updates };
  sourceDiff.value = [];
  databaseNotice.value = `已应用 ${Object.keys(updates).length} 项资料更新`;
};

const onImageFile = event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    renderError.value = '请选择图片文件';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    cropSource.value = String(reader.result);
    renderError.value = '';
  };
  reader.onerror = () => {
    renderError.value = '图片读取失败';
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

const applyCroppedImage = dataUrl => {
  form.data.image = dataUrl;
  cropSource.value = '';
};

const removeImage = () => {
  form.data.image = '';
};

const exportImage = async () => {
  if (!cardLeaf.value || isExporting.value) {
    return;
  }
  isExporting.value = true;
  renderError.value = '';
  try {
    const safeName = String(form.data.name || activePreset.value.shortTitle).replace(/[\\/:*?"<>|]/g, '-');
    await cardLeaf.value.export(`${safeName}.png`, {
      screenshot: true,
      pixelRatio: window.devicePixelRatio || 1,
    });
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isExporting.value = false;
  }
};

const loadCustomDeckCard = async customCard => {
  const preset = cardPresets.find(item =>
    item.key === (customCard.cardKind || 'yugioh'));
  if (!preset) {
    throw new Error('原创卡使用了不可用的卡片模板');
  }
  await ensurePresetLoaded(preset);
  const kindChanged = form.card !== preset.key;
  renderState.value = '更新预览';
  form.card = preset.key;
  form.data = cloneData(customCard.data);
  sourceCardId.value = customCard.sourceCardId || '';
  databaseQuery.value = customCard.name;
  databaseResults.value = [];
  databaseError.value = '';
  databaseNotice.value = `已载入卡组原创卡 · ${customCard.name}`;
  if (kindChanged) {
    await createCardRenderer();
  }
  resetHistory();
};

const loadDeckCardContext = async (projectId, section, cardId) => {
  const project = await getProject(projectId);
  if (!project || (project.kind || 'deck') !== 'deck') {
    throw new Error('来源卡组不存在');
  }
  Object.assign(deckContext, {
    projectId: project.id,
    projectName: project.name,
    section: ['main', 'extra', 'side'].includes(section) ? section : 'main',
    sourceId: cardId,
  });
  const customCard = getCustomCard(project.customCards, cardId);
  if (isCustomCardId(cardId)) {
    if (!customCard) {
      throw new Error('来源卡组缺少这张原创卡的数据');
    }
    await loadCustomDeckCard(customCard);
    return true;
  }
  return false;
};

const loadBatchCardContext = async (projectId, cardId) => {
  const project = await getProject(projectId);
  if (!project || project.kind !== 'batch') {
    throw new Error('来源批量制卡方案不存在');
  }
  const sourceCard = project.cards.find(item => item.batchId === cardId);
  if (!sourceCard) {
    throw new Error('来源批量制卡方案缺少这张卡');
  }
  Object.assign(batchContext, {
    projectId: project.id,
    projectName: project.name,
    sourceId: sourceCard.batchId,
  });
  const preset = cardPresets[0];
  const kindChanged = form.card !== preset.key;
  form.card = preset.key;
  form.data = cloneData(sourceCard);
  sourceCardId.value = sourceCard.sourceCardId || '';
  databaseQuery.value = sourceCard.name;
  databaseResults.value = [];
  databaseError.value = '';
  databaseNotice.value = `已载入批量卡片 · ${sourceCard.name}`;
  if (kindChanged) {
    await createCardRenderer();
  }
  resetHistory();
};

const writeBackToDeck = async mode => {
  if (!hasDeckContext.value || isWritingBack.value) return;
  if (form.card !== 'yugioh') {
    databaseError.value = '卡组回写暂仅支持游戏王标准卡模板';
    return;
  }
  isWritingBack.value = true;
  databaseError.value = '';
  try {
    const project = await getProject(deckContext.projectId);
    if (!project || (project.kind || 'deck') !== 'deck') {
      throw new Error('来源卡组不存在');
    }
    const existing = getCustomCard(
      project.customCards,
      deckContext.sourceId,
    );
    const customCard = createCustomCard(toRaw(form.data), {
      id: existing?.id,
      cardKind: form.card,
      sourceCardId: existing?.sourceCardId || deckContext.sourceId,
    });
    const saved = await saveProject(writeCustomCardToDeck(
      project,
      customCard,
      {
        mode,
        section: deckContext.section,
        sourceId: deckContext.sourceId,
      },
    ));
    setActiveProjectId(saved.id, 'deck');
    location.href = '../print/';
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isWritingBack.value = false;
  }
};

const writeBackToBatch = async mode => {
  if (!hasBatchContext.value || isWritingBack.value) return;
  if (form.card !== 'yugioh') {
    databaseError.value = '批量制卡暂仅支持游戏王标准卡模板';
    return;
  }
  isWritingBack.value = true;
  databaseError.value = '';
  try {
    const project = await getProject(batchContext.projectId);
    if (!project || project.kind !== 'batch') {
      throw new Error('来源批量制卡方案不存在');
    }
    const saved = await saveProject(writeBatchCard(
      project,
      toRaw(form.data),
      {
        mode,
        sourceId: batchContext.sourceId,
        sourceCardId: sourceCardId.value,
      },
    ));
    setActiveProjectId(saved.id, 'batch');
    location.href = '../batch/';
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isWritingBack.value = false;
  }
};

const writeBackToSource = mode => {
  if (hasBatchContext.value) {
    writeBackToBatch(mode);
  } else {
    writeBackToDeck(mode);
  }
};

const getActiveBatchProject = async () => {
  const activeId = getActiveProjectId('batch');
  const active = activeId ? await getProject(activeId) : null;
  if (active?.kind === 'batch') return active;
  return saveProject({
    kind: 'batch',
    name: '我的批量制卡方案',
    cards: [],
  });
};

const addCurrentToBatch = async () => {
  if (form.card !== 'yugioh') {
    databaseError.value = '批量制卡暂仅支持游戏王标准卡模板';
    return;
  }
  try {
    const project = await getActiveBatchProject();
    const batchCard = createBatchCard(toRaw(form.data), {
      sourceCardId: sourceCardId.value,
    });
    const saved = await saveProject(appendBatchCards(project, [batchCard]));
    setActiveProjectId(saved.id, 'batch');
    databaseNotice.value = `${form.data.name || '当前卡片'} 已加入“${saved.name}”`;
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
  }
};

const refreshProjects = async () => {
  projects.value = await listProjects('card');
};

const projectSnapshot = () => ({
  id: activeProjectId.value,
  revision: activeProjectRevision.value,
  kind: 'card',
  name: projectName.value,
  cardKind: form.card,
  sourceCardId: sourceCardId.value,
  data: cloneData(toRaw(form.data)),
});

const saveCurrentProject = async () => {
  try {
    const saved = await saveProject(projectSnapshot());
    activeProjectId.value = saved.id;
    activeProjectRevision.value = saved.revision;
    projectName.value = saved.name;
    setActiveProjectId(saved.id, 'card');
    await refreshProjects();
    databaseNotice.value = '单卡草稿已保存';
    return saved;
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
    return null;
  }
};

const duplicateCurrentProject = async () => {
  const saved = await duplicateProject(projectSnapshot());
  await refreshProjects();
  await applyProject(saved);
  databaseNotice.value = '已创建单卡草稿副本';
};

const applyProject = async project => {
  if (!project || project.kind !== 'card') return;
  const preset = cardPresets.find(item => item.key === project.cardKind);
  if (!preset) {
    databaseError.value = '单卡草稿中的卡片模板不可用';
    return;
  }
  loadingProject = true;
  activeProjectId.value = project.id;
  activeProjectRevision.value = project.revision || 0;
  projectName.value = project.name;
  const kindChanged = form.card !== project.cardKind;
  renderState.value = '更新预览';
  form.card = project.cardKind;
  form.data = cloneData(project.data);
  sourceCardId.value = project.sourceCardId || '';
  activeTab.value = 'card';
  databaseResults.value = [];
  databaseError.value = '';
  databaseNotice.value = '';
  if (kindChanged) {
    await createCardRenderer();
  }
  resetHistory();
  setActiveProjectId(project.id, 'card');
  await nextTick();
  loadingProject = false;
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
  activeProjectId.value = '';
  activeProjectRevision.value = 0;
  projectName.value = '未命名单卡';
  form.data = cloneData(activePreset.value.demo);
  sourceCardId.value = '';
  databaseQuery.value = '';
  databaseResults.value = [];
  databaseError.value = '';
  databaseNotice.value = '';
  resetHistory();
  setActiveProjectId('', 'card');
  nextTick(() => {
    loadingProject = false;
  });
};

const removeCurrentProject = async () => {
  if (!activeProjectId.value ||
    !window.confirm(`删除“${projectName.value}”？此操作无法撤销。`)) {
    return;
  }
  await deleteProject(activeProjectId.value);
  createProject();
  await refreshProjects();
};

const downloadProject = (content, filename) => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
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
  const safeName = String(projectName.value || '未命名单卡')
    .replace(/[\\/:*?"<>|]/g, '-');
  downloadProject(serializeProject(projectSnapshot()), `${safeName}.ygoproject`);
};

const importProjectFile = async file => {
  try {
    const imported = parseProject(await file.text());
    if (imported.kind !== 'card') {
      throw new Error('这个文件不是单卡草稿备份');
    }
    const saved = await saveProject(imported);
    await refreshProjects();
    await applyProject(saved);
    databaseNotice.value = '单卡草稿已导入';
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
  }
};

const toGithub = () => {
  window.open(
    'https://github.com/ASTion24/better-yugioh-card',
    '_blank',
    'noopener',
  );
};

const onKeydown = event => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') {
    return;
  }
  event.preventDefault();
  event.shiftKey ? redo() : undo();
};

watch(() => form.data, () => {
  if (cardLeaf.value) {
    cancelAnimationFrame(renderFrame);
    const request = ++renderRequest;
    renderFrame = requestAnimationFrame(async () => {
      if (!cardLeaf.value) return;
      renderState.value = '更新预览';
      renderError.value = '';
      try {
        await cardLeaf.value.setData(cloneData(toRaw(form.data)));
        await cardLeaf.value.ready();
        if (request === renderRequest) {
          renderState.value = '实时预览';
        }
      } catch (error) {
        if (request === renderRequest) {
          renderError.value = error instanceof Error ? error.message : String(error);
        }
      }
    });
  }
  scheduleHistory();
}, { deep: true });

watch(() => [form.data.type, form.data.cardType], () => {
  if (isPendulum.value) {
    form.data.pendulumType = `${form.data.cardType || 'effect'}-pendulum`;
  }
  form.data.firstLineCompress =
    isMonster.value && isExtraDeckCardType(form.data.cardType);
});

watch(availableTabs, tabs => {
  if (!tabs.some(tab => tab.key === activeTab.value)) {
    activeTab.value = 'card';
  }
});

watch(
  () => ({
    id: activeProjectId.value,
    name: projectName.value,
    cardKind: form.card,
    data: form.data,
  }),
  () => {
    if (!activeProjectId.value || loadingProject) return;
    clearTimeout(projectSaveTimer);
    projectSaveTimer = setTimeout(saveCurrentProject, 700);
  },
  { deep: true },
);

onMounted(async () => {
  resetHistory();
  await createCardRenderer();
  resizeObserver = new ResizeObserver(updatePreviewScale);
  resizeObserver.observe(previewPanel.value);
  window.addEventListener('keydown', onKeydown);
  const searchParams = new URLSearchParams(location.search);
  const requestedCard = searchParams.get('card');
  const sourceProjectId = searchParams.get('deckProject');
  const batchProjectId = searchParams.get('batchProject');
  const batchCardId = searchParams.get('batchCard');
  if (batchProjectId && batchCardId) {
    try {
      await loadBatchCardContext(batchProjectId, batchCardId);
    } catch (error) {
      databaseError.value = error instanceof Error
        ? error.message
        : String(error);
    }
    return;
  }
  if (requestedCard) {
    if (sourceProjectId) {
      try {
        const loadedCustomCard = await loadDeckCardContext(
          sourceProjectId,
          searchParams.get('deckSection') || 'main',
          requestedCard,
        );
        if (loadedCustomCard) return;
      } catch (error) {
        databaseError.value = error instanceof Error
          ? error.message
          : String(error);
        return;
      }
    }
    databaseQuery.value = requestedCard;
    await searchDatabase();
    return;
  }
  try {
    await refreshProjects();
    const activeId = getActiveProjectId('card');
    if (activeId) {
      await applyProject(await getProject(activeId));
    }
  } catch (error) {
    databaseError.value = error instanceof Error ? error.message : String(error);
  }
});

onBeforeUnmount(() => {
  clearTimeout(historyTimer);
  clearTimeout(projectSaveTimer);
  cancelAnimationFrame(renderFrame);
  resizeObserver?.disconnect();
  window.removeEventListener('keydown', onKeydown);
  cardLeaf.value?.destroy();
});
</script>

<style lang="scss" src="../styles/editor.scss" scoped />
