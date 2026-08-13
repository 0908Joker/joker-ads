<template>
  <TabShell active="anime">
    <SearchBar />
    <nav class="main-tabs">
      <button v-for="tab in tabList" :key="tab" class="tab" :class="{ 'is-active': active === tab }" @click="active = tab">{{ tab }}</button>
      <span class="tab-tools">
        <button class="tool-btn" aria-label="筛选">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffd24a"><path d="M4 6h16v2H4zm3 5h10v2H7zm3 5h4v2h-4z"/></svg>
        </button>
        <button class="tool-btn" aria-label="书架">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffd24a"><path d="M6 4h3v16H6zm5 0h3v16h-3zm5 0h3v16h-3z"/></svg>
        </button>
      </span>
    </nav>
    <div class="vip-banner">
      <div>
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
    <section v-if="preview.length" class="section">
      <header class="sec-head"><h3>更新预告</h3><span>更多></span></header>
      <div class="comic-scroll">
        <article v-for="(c, i) in preview" :key="'p-' + i" class="comic-card">
          <CebImg class="comic-card__cover" :path="c.coverLocal || c.cover" />
          <p class="comic-card__type">{{ c.type }} · {{ c.status }}</p>
          <h4>{{ c.title }}</h4>
        </article>
      </div>
    </section>
    <div class="mid-actions">
      <button>分类</button>
      <button>最近观看</button>
    </div>
    <section v-for="sec in sections" :key="sec.title" class="section">
      <header class="sec-head"><h3>{{ sec.title }}</h3><span>更多></span></header>
      <div class="comic-scroll">
        <article v-for="(c, i) in sec.items" :key="i" class="comic-card">
          <CebImg class="comic-card__cover" :path="c.coverLocal || c.cover" />
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
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import baked from '../data/circle-comics.json'
import { fetchHomeComic, fetchHomeComicSuper } from '../api/comics.js'
import { normalizeComic } from '../api/normalize.js'

const tabList = tabsFallback.anime.tabs
const filters = tabsFallback.anime.filters
const active = ref('漫画')
const bakedSections = (baked.sections || []).map((s) => ({
  title: s.title === '最近更新' ? '更新预告' : s.title === '连载中' ? '韩漫' : s.title === '已完结' ? '同人' : s.title,
  items: s.items || [],
}))
const comics = ref(baked.comicsHome?.length ? baked.comicsHome : tabsFallback.anime.comics)
const liveSections = ref(bakedSections)

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

const preview = computed(() => liveSections.value.find((s) => s.title === '更新预告')?.items || comics.value.slice(0, 3))
const sections = computed(() => {
  const rest = liveSections.value.filter((s) => s.title !== '更新预告')
  if (rest.length) return rest
  const list = comics.value
  return [
    { title: '韩漫', items: list.slice(0, 4) },
    { title: '同人', items: list.slice(2, 6) },
  ]
})

async function loadComics() {
  try {
    const raw = await fetchHomeComicSuper()
    const data = raw.data ?? raw
    const list = Array.isArray(data) ? data : []
    if (list.length) {
      liveSections.value = list.map((s) => ({
        title: s.flagName === '最近更新' ? '更新预告' : s.flagName === '连载中' ? '韩漫' : s.flagName === '已完结' ? '同人' : (s.flagName || s.name),
        items: (s.comicList || s.list || []).map(normalizeComic).filter(Boolean),
      }))
      const flat = liveSections.value.flatMap((s) => s.items)
      if (flat.length) comics.value = flat
      return
    }
  } catch {}
  try {
    const raw = await fetchHomeComic({ tab: active.value })
    const data = raw.data ?? raw
    const list = (data?.comics || data?.list || []).map(normalizeComic).filter((c) => c?.title && c.title.length > 1 && !/全部|主题|分类|最近/.test(c.title))
    if (list.length >= 3) comics.value = list
  } catch {
    comics.value = baked.comicsHome?.length ? baked.comicsHome : tabsFallback.anime.comics
  }
}

watch(active, () => loadComics(), { immediate: true })
</script>

<style scoped>
.main-tabs { align-items: center; display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.08rem 0.32rem 0.2rem; white-space: nowrap; }
.tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.4rem; padding-bottom: 0.12rem; position: relative; }
.tab.is-active { color: #fff; font-weight: 700; }
.tab.is-active::after {
  background: #f81942; border-radius: 0.8rem; bottom: 0; content: ''; height: 0.08rem;
  left: 10%; position: absolute; right: 10%;
}
.tab-tools { display: flex; gap: 0.12rem; margin-left: auto; }
.tool-btn { background: none; border: none; padding: 0.04rem; }
.vip-banner {
  align-items: center; background: linear-gradient(90deg,#3d2a10,#1a1a1a); border-radius: 0.16rem;
  display: flex; justify-content: space-between; margin: 0 0.32rem 0.2rem; padding: 0.2rem 0.28rem;
}
.vip-banner p { color: #ffd700; font-size: 0.28rem; }
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
.comic-card__cover,
:deep(.comic-card__cover) { aspect-ratio: 3/4; background: linear-gradient(135deg,#333,#1a1a1a); border-radius: 0.12rem; object-fit: cover; width: 100%; }
.comic-card__type { color: rgba(255,255,255,.45); font-size: 0.22rem; margin-top: 0.08rem; }
.comic-card h4 { font-size: 0.26rem; line-height: 1.3; margin-top: 0.04rem; }
</style>
