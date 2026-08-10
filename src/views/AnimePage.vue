<template>
  <TabShell active="anime">
    <nav class="main-tabs">
      <button v-for="tab in tabList" :key="tab" class="tab" :class="{ 'is-active': active === tab }" @click="active = tab">{{ tab }}</button>
    </nav>
    <div class="date-strip">
      <span v-for="d in dates" :key="d" class="date">{{ d }}</span>
    </div>
    <div class="vip-banner">
      <span>您还不是会员 开通会员</span>
      <button>开通会员</button>
    </div>
    <div class="filters">
      <button v-for="f in filters" :key="f" class="filter">{{ f }}</button>
    </div>
    <section class="comic-grid">
      <article v-for="(c, i) in comics" :key="i" class="comic-card">
        <img v-if="c.coverLocal" :src="c.coverLocal" alt="" class="comic-card__cover" />
        <div v-else class="comic-card__cover comic-card__cover--ph" />
        <p class="comic-card__type">{{ c.type }} · {{ c.status }}</p>
        <h3>{{ c.title }}</h3>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'

const tabList = tabsFallback.anime.tabs
const filters = tabsFallback.anime.filters
const dates = ['07 周五', '08 周六', '09 周日', '10 今日', '11 周二', '12 周三', '13 周四']
const active = ref('漫画')
const comics = computed(() => {
  const live = feeds.anime?.comics?.filter((c) => c.title)
  return live?.length ? live : tabsFallback.anime.comics
})
</script>

<style scoped>
.main-tabs { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.32rem; white-space: nowrap; }
.tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.4rem; }
.tab.is-active { color: #fff; font-weight: 700; }
.date-strip { display: flex; gap: 0.16rem; overflow-x: auto; padding: 0 0.32rem 0.16rem; white-space: nowrap; }
.date { color: rgba(255,255,255,.45); font-size: 0.26rem; }
.vip-banner {
  align-items: center; background: linear-gradient(90deg,#3d2a10,#1a1a1a); border-radius: 0.16rem;
  display: flex; justify-content: space-between; margin: 0 0.32rem 0.24rem; padding: 0.24rem 0.32rem;
}
.vip-banner span { color: #ffd700; font-size: 0.32rem; }
.vip-banner button { background: linear-gradient(180deg,#ffd700,#f39c12); border: none; border-radius: 0.8rem; color: #333; font-size: 0.28rem; padding: 0.12rem 0.32rem; }
.filters { display: flex; flex-wrap: wrap; gap: 0.16rem; padding: 0 0.32rem 0.24rem; }
.filter { background: rgba(255,255,255,.08); border: none; border-radius: 0.8rem; color: rgba(255,255,255,.7); font-size: 0.28rem; padding: 0.1rem 0.24rem; }
.comic-grid { display: grid; gap: 0.24rem; grid-template-columns: repeat(3, 1fr); padding: 0 0.32rem; }
.comic-card__cover { aspect-ratio: 3/4; border-radius: 0.12rem; object-fit: cover; width: 100%; }
.comic-card__cover--ph { background: linear-gradient(135deg,#333,#222); }
.comic-card__type { color: rgba(255,255,255,.45); font-size: 0.24rem; margin-top: 0.12rem; }
.comic-card h3 { font-size: 0.28rem; line-height: 1.3; margin-top: 0.08rem; }
</style>
