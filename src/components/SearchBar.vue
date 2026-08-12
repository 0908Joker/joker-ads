<template>
  <header class="search-bar">
    <span class="search-bar__icon">🔍</span>
    <div class="search-bar__words">
      <span v-for="w in words" :key="w" class="search-bar__word">{{ w }}</span>
    </div>
    <span v-if="trailing" class="search-bar__trail">{{ trailing }}</span>
  </header>
</template>

<script setup>
defineProps({
  words: { type: Array, default: () => ['美女', '巨乳', '奶子', '帅哥'] },
  trailing: { type: String, default: '' },
})
</script>

<style scoped>
.search-bar {
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  display: flex;
  gap: 0.16rem;
  margin: 0.2rem 0.32rem;
  padding: 0.14rem 0.24rem;
}
.search-bar__icon { font-size: 0.32rem; opacity: 0.55; }
.search-bar__words { display: flex; flex: 1; gap: 0.24rem; overflow-x: auto; white-space: nowrap; }
.search-bar__word { color: rgba(255,255,255,.55); font-size: 0.28rem; }
.search-bar__trail { color: rgba(255,255,255,.35); font-size: 0.32rem; }
</style>
