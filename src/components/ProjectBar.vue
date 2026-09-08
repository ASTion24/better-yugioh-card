<template>
  <section class="project-bar" aria-label="本地项目">
    <select
      :value="projectId"
      aria-label="选择本地项目"
      @change="$emit('select', $event.target.value)"
    >
      <option value="">临时项目</option>
      <option v-for="project in projects" :key="project.id" :value="project.id">
        {{ project.name }}
      </option>
    </select>
    <input
      :value="name"
      type="text"
      aria-label="项目名称"
      :placeholder="namePlaceholder"
      @input="$emit('rename', $event.target.value)"
    >
    <button type="button" title="新建项目" @click="$emit('create')">
      <Icon icon="ri:file-add-line" />
    </button>
    <button type="button" title="保存项目" @click="$emit('save')">
      <Icon icon="ri:save-3-line" />
    </button>
    <button
      type="button"
      title="创建项目副本"
      :disabled="!projectId"
      @click="$emit('duplicate')"
    >
      <Icon icon="ri:file-copy-2-line" />
    </button>
    <button
      type="button"
      title="导出项目"
      :disabled="!projectId"
      @click="$emit('export')"
    >
      <Icon icon="ri:archive-line" />
    </button>
    <button type="button" title="导入项目" @click="fileInput?.click()">
      <Icon icon="ri:folder-open-line" />
    </button>
    <button
      class="danger"
      type="button"
      title="删除项目"
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
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

defineProps({
  projectId: { type: String, default: '' },
  name: { type: String, default: '' },
  namePlaceholder: { type: String, default: '项目名称' },
  projects: { type: Array, default: () => [] },
});

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
