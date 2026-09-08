<template>
  <section class="project-bar" :aria-label="`本地${entityName}`">
    <select
      :value="projectId"
      :aria-label="`选择本地${entityName}`"
      @change="$emit('select', $event.target.value)"
    >
      <option value="">临时{{ entityName }}</option>
      <option v-for="project in projects" :key="project.id" :value="project.id">
        {{ project.name }}
      </option>
    </select>
    <input
      :value="name"
      type="text"
      :aria-label="`${entityName}名称`"
      :placeholder="namePlaceholder || `${entityName}名称`"
      @input="$emit('rename', $event.target.value)"
    >
    <button type="button" :title="`新建${entityName}`" @click="$emit('create')">
      <Icon icon="ri:file-add-line" />
    </button>
    <button type="button" :title="`保存${entityName}`" @click="$emit('save')">
      <Icon icon="ri:save-3-line" />
    </button>
    <button
      type="button"
      :title="`创建${entityName}副本`"
      :disabled="!projectId"
      @click="$emit('duplicate')"
    >
      <Icon icon="ri:file-copy-2-line" />
    </button>
    <button
      type="button"
      :title="`导出${entityName}`"
      :disabled="!projectId"
      @click="$emit('export')"
    >
      <Icon icon="ri:archive-line" />
    </button>
    <button type="button" :title="`导入${entityName}`" @click="fileInput?.click()">
      <Icon icon="ri:folder-open-line" />
    </button>
    <button
      class="danger"
      type="button"
      :title="`删除${entityName}`"
      :disabled="!projectId"
      @click="$emit('remove')"
    >
      <Icon icon="ri:delete-bin-line" />
    </button>
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept=".ygoproject,.json,application/json"
      @change="onFile"
    >
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
  projectId: { type: String, default: '' },
  name: { type: String, default: '' },
  namePlaceholder: { type: String, default: '' },
  entityLabel: { type: String, default: '内容' },
  projects: { type: Array, default: () => [] },
});
const entityName = computed(() => props.entityLabel.trim() || '内容');

const emit = defineEmits([
  'select',
  'rename',
  'create',
  'save',
  'duplicate',
  'export',
  'import',
  'remove',
]);
const fileInput = ref(null);

const onFile = event => {
  const file = event.target.files?.[0];
  if (file) {
    emit('import', file);
  }
  event.target.value = '';
};
</script>

<style lang="scss" scoped>
.project-bar {
  display: grid;
  grid-template-columns: minmax(70px, 0.8fr) minmax(84px, 1.2fr) repeat(6, 30px);
  gap: 4px;
  padding: 12px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  background: #f8f7f3;
}

select,
input,
button {
  height: 34px;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  background: var(--paper);
  font: inherit;
}

select,
input {
  padding: 0 9px;
  font-size: 11px;
}

button {
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 16px;
}

button:hover:not(:disabled) {
  border-color: var(--teal);
  color: var(--teal);
}

button.danger:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .project-bar {
    grid-template-columns: minmax(70px, 1fr) minmax(84px, 1fr) repeat(6, 30px);
    padding: 10px 18px;
  }
}
</style>
