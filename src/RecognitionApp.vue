<template>
  <div class="recognition-app">
    <header class="app-bar">
      <a class="back-link" href="../" title="返回工作台">
        <Icon icon="ri:arrow-left-line" />
        <span>工作台</span>
      </a>
      <a class="brand" href="../">
        <span class="brand-mark">YG</span>
        <div>
          <h1>卡牌图像识别</h1>
          <p>CARD IMAGE RECOGNITION</p>
        </div>
      </a>
      <div class="header-status">单卡 · 多卡</div>
    </header>

    <main>
      <DeckImageImporter standalone />
    </main>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import DeckImageImporter from './components/DeckImageImporter.vue';
</script>

<style lang="scss" scoped>
.recognition-app {
  --paper: #fffefa;
  --canvas: #f0eee8;
  --ink: #1b1c19;
  --muted: #74716a;
  --line: #d6d2c9;
  --accent: #b64532;
  --teal: #285e58;
  height: 100dvh;
  display: grid;
  grid-template-rows: 62px minmax(0, 1fr);
  overflow: hidden;
  color: var(--ink);
  background: var(--canvas);
}

.app-bar {
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.back-link,
.brand {
  color: inherit;
  text-decoration: none;
}

.back-link {
  width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  font-size: 9px;
  font-weight: 800;
}

.brand h1,
.brand p {
  margin: 0;
}

.brand h1 {
  font-family: "Songti SC", "STSong", serif;
  font-size: 17px;
}

.brand p {
  margin-top: 2px;
  color: var(--accent);
  font-size: 7px;
  font-weight: 800;
}

.header-status {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 9px;
}

main {
  min-height: 0;
}

@media (max-width: 600px) {
  .recognition-app {
    grid-template-rows: 56px minmax(0, 1fr);
  }

  .app-bar {
    grid-template-columns: 32px 1fr auto;
    padding: 0 12px;
  }

  .back-link span {
    display: none;
  }

  .brand {
    justify-self: center;
  }

  .brand-mark {
    display: none;
  }

  .header-status span {
    display: none;
  }
}
</style>
