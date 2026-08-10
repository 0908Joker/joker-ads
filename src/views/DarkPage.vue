<template>
  <TabShell active="dark">
    <div class="dark-page">
      <div class="tag-cloud">
        <button v-for="tag in data.tags" :key="tag" class="dark-tag">{{ tag }}</button>
      </div>
      <p class="hint">暗网专区 · 点击标签浏览</p>
    </div>
  </TabShell>
</template>

<script setup>
import TabShell from '../components/TabShell.vue'
import tabs from '../data/tabs.json'

const data = tabs.dark
</script>

<style scoped>
.dark-page { min-height: 60vh; padding: 0.48rem 0.32rem; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.24rem; justify-content: center; padding-top: 1.6rem; }
.dark-tag { background: rgba(255,45,85,.12); border: 1px solid rgba(255,45,85,.35); border-radius: 0.8rem; color: #ff6b8a; font-size: 0.36rem; padding: 0.2rem 0.4rem; }
.hint { color: rgba(255,255,255,.35); font-size: 0.28rem; margin-top: 0.8rem; text-align: center; }
</style>
