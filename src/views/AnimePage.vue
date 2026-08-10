<template>
  <TabShell active="anime">
    <nav class="main-tabs">
      <button v-for="tab in data.tabs" :key="tab" class="tab" :class="{ 'is-active': active === tab }" @click="active = tab">{{ tab }}</button>
    </nav>
    <div class="vip-banner">
      <span>{{ data.vipBanner }}</span>
      <button>开通会员</button>
    </div>
    <div class="filters">
      <button v-for="f in data.filters" :key="f" class="filter">{{ f }}</button>
    </div>
    <section class="comic-grid">
      <article v-for="(c, i) in data.comics" :key="i" class="comic-card">
        <div class="cover" />
        <p class="type">{{ c.type }} · {{ c.status }}</p>
        <h3>{{ c.title }}</h3>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref } from 'vue'
import TabShell from '../components/TabShell.vue'
import tabs from '../data/tabs.json'

const data = tabs.anime
const active = ref('漫画')
</script>

<style scoped>
.main-tabs { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.32rem; white-space: nowrap; }
.tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.4rem; }
.tab.is-active { color: #fff; font-weight: 700; }
.vip-banner { align-items: center; background: linear-gradient(90deg,#3d2a10,#1a1a1a); display: flex; justify-content: space-between; margin: 0 0.32rem 0.24rem; padding: 0.24rem 0.32rem; border-radius: 0.16rem; }
.vip-banner span { color: #ffd700; font-size: 0.32rem; }
.vip-banner button { background: linear-gradient(180deg,#ffd700,#f39c12); border: none; border-radius: 0.8rem; color: #333; font-size: 0.28rem; padding: 0.12rem 0.32rem; }
.filters { display: flex; flex-wrap: wrap; gap: 0.16rem; padding: 0 0.32rem 0.24rem; }
.filter { background: rgba(255,255,255,.08); border: none; border-radius: 0.8rem; color: rgba(255,255,255,.7); font-size: 0.28rem; padding: 0.1rem 0.24rem; }
.comic-grid { display: grid; gap: 0.24rem; grid-template-columns: repeat(3, 1fr); padding: 0 0.32rem; }
.comic-card .cover { aspect-ratio: 3/4; background: linear-gradient(135deg,#333,#222); border-radius: 0.12rem; }
.comic-card .type { color: rgba(255,255,255,.45); font-size: 0.24rem; margin-top: 0.12rem; }
.comic-card h3 { font-size: 0.28rem; line-height: 1.3; margin-top: 0.08rem; }
</style>
