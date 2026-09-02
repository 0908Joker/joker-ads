<template>
  <header class="search-bar" :class="{ 'search-bar--tap': to }" @click="onClick">
    <span class="search-bar__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" stroke-linecap="round" />
      </svg>
    </span>
    <div class="search-bar__words">
      <span v-for="w in words" :key="w" class="search-bar__word">{{ w }}</span>
    </div>
    <span v-if="trailing" class="search-bar__trail">{{ trailing }}</span>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  words: { type: Array, default: () => ['美女', '巨乳', '奶子', '帅哥'] },
  trailing: { type: String, default: '' },
  to: { type: String, default: '' },
})

const router = useRouter()

function onClick() {
  if (props.to) router.push(props.to)
}
</script>

<style scoped>
.search-bar {
  align-items: center;
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: 999px;
  display: flex;
  gap: 0.16rem;
  margin: 0.2rem var(--dw-pad-x);
  padding: 0.14rem 0.24rem;
}
.search-bar--tap {
  cursor: pointer;
}
.search-bar__icon {
  align-items: center;
  color: rgba(255,255,255,.55);
  display: flex;
  font-size: 0.32rem;
  opacity: 1;
}
.search-bar__words { display: flex; flex: 1; gap: 0.24rem; overflow-x: auto; white-space: nowrap; }
.search-bar__word { color: rgba(255,255,255,.55); font-size: 0.28rem; }
.search-bar__trail { color: rgba(255,255,255,.35); font-size: 0.32rem; }
</style>
