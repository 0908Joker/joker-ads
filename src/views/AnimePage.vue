<template>
  <TabShell active="anime">
    <SearchBar />
    <nav class="main-tabs">
      <button v-for="tab in tabList" :key="tab" class="tab" :class="{ 'is-active': active === tab }" @click="active = tab">{{ tab }}</button>
    </nav>
    <div class="vip-banner">
      <div>
        <strong>小红书VIP会员</strong>
        <p>您还不是会员</p>
      </div>
      <button>开通会员</button>
    </div>
    <div class="filters">
      <button v-for="f in filters" :key="f" class="filter" :class="{ 'is-active': f === '全部' }">{{ f }}</button>
    </div>
    <div class="date-strip">
      <span v-for="d in dates" :key="d.label" class="date" :class="{ 'is-today': d.today }">{{ d.label }}</span>
    </div>
    <div class="mid-actions">
      <button>分类</button>
      <button>最近观看</button>
    </div>
    <section v-for="sec in sections" :key="sec.title" class="section">
      <header class="sec-head"><h3>{{ sec.title }}</h3><span>更多></span></header>
      <div class="comic-scroll">
        <article v-for="(c, i) in sec.items" :key="i" class="comic-card">
          <div class="comic-card__cover" />
          <p class="comic-card__type">{{ c.type }} · {{ c.status }}</p>
          <h4>{{ c.title }}</h4>
        </article>
      </div>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import tabsFallback from '../data/tabs.json'
import { fetchHomeComic } from '../api/comics.js'
import { normalizeComic } from '../api/normalize.js'

const tabList = tabsFallback.anime.tabs
const filters = tabsFallback.anime.filters
const active = ref('漫画')
const comics = ref(tabsFallback.anime.comics)

const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const dates = computed(() => {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - 3 + i)
    const today = i === 3
    return { label: `${String(d.getDate()).padStart(2, '0')} ${today ? '今日' : week[d.getDay()]}`, today }
  })
})

const sections = computed(() => {
  const list = comics.value
  return [
    { title: '韩漫', items: list.slice(0, 4) },
    { title: '同人', items: list.slice(2, 6) },
  ]
})

async function loadComics() {
  try {
    const raw = await fetchHomeComic({ tab: active.value })
    const data = raw.data ?? raw
    const list = (data?.comics || data?.list || []).map(normalizeComic).filter((c) => c?.title && c.title.length > 1 && !/全部|主题|分类|最近/.test(c.title))
    if (list.length >= 3) comics.value = list
  } catch {
    comics.value = tabsFallback.anime.comics
  }
}

watch(active, () => loadComics(), { immediate: true })
</script>

<style scoped>
.main-tabs { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.08rem 0.32rem 0.2rem; white-space: nowrap; }
.tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.4rem; padding-bottom: 0.12rem; position: relative; }
.tab.is-active { color: #fff; font-weight: 700; }
.tab.is-active::after { background: #f81942; border-radius: 0.8rem; bottom: 0; content: ''; height: 0.08rem; left: 20%; position: absolute; right: 20%; }
.vip-banner {
  align-items: center; background: linear-gradient(90deg,#3d2a10,#1a1a1a); border-radius: 0.16rem;
  display: flex; justify-content: space-between; margin: 0 0.32rem 0.2rem; padding: 0.2rem 0.28rem;
}
.vip-banner strong { color: #ffd700; font-size: 0.32rem; }
.vip-banner p { color: rgba(255,255,255,.6); font-size: 0.24rem; }
.vip-banner button { background: #f81942; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.28rem; padding: 0.12rem 0.28rem; }
.filters { display: flex; gap: 0.16rem; overflow-x: auto; padding: 0 0.32rem 0.16rem; white-space: nowrap; }
.filter { background: none; border: none; color: rgba(255,255,255,.6); font-size: 0.28rem; padding: 0.08rem 0.12rem; }
.filter.is-active { color: #f81942; font-weight: 600; }
.date-strip { display: flex; gap: 0.12rem; overflow-x: auto; padding: 0 0.32rem 0.2rem; white-space: nowrap; }
.date { color: rgba(255,255,255,.45); font-size: 0.26rem; padding: 0.08rem 0.12rem; }
.date.is-today { background: #f81942; border-radius: 50%; color: #fff; }
.mid-actions { display: flex; gap: 0.16rem; padding: 0 0.32rem 0.24rem; }
.mid-actions button {
  background: #f81942; border: none; border-radius: 0.8rem; color: #fff; flex: 1; font-size: 0.32rem; padding: 0.16rem;
}
.section { padding: 0 0.32rem 0.24rem; }
.sec-head { align-items: center; display: flex; justify-content: space-between; margin-bottom: 0.12rem; }
.sec-head h3 { font-size: 0.36rem; }
.sec-head span { color: #f81942; font-size: 0.28rem; }
.comic-scroll { display: flex; gap: 0.16rem; overflow-x: auto; }
.comic-card { flex-shrink: 0; width: 2.2rem; }
.comic-card__cover { aspect-ratio: 3/4; background: linear-gradient(135deg,#333,#1a1a1a); border-radius: 0.12rem; }
.comic-card__type { color: rgba(255,255,255,.45); font-size: 0.22rem; margin-top: 0.08rem; }
.comic-card h4 { font-size: 0.26rem; line-height: 1.3; margin-top: 0.04rem; }
</style>
