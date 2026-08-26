<template>
  <TabShell active="anime">
    <SearchBar />
    <nav class="main-tabs">
      <button
        v-for="tab in tabList"
        :key="tab"
        class="tab"
        :class="{ 'is-active': active === tab }"
        @click="active = tab"
      >{{ tab }}</button>
      <span class="tab-tools">
        <button class="tool-btn" aria-label="筛选" @click="onFilterTool">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffd24a"><path d="M4 6h16v2H4zm3 5h10v2H7zm3 5h4v2h-4z"/></svg>
        </button>
        <button class="tool-btn" aria-label="书架" @click="onBookshelf">
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
    <div ref="filtersEl" class="filters">
      <button
        v-for="f in filters"
        :key="f"
        class="filter"
        :class="{ 'is-active': activeFilter === f }"
        @click="activeFilter = f"
      >{{ f }}</button>
    </div>
    <div class="date-strip">
      <span
        v-for="d in dates"
        :key="d.key"
        class="date"
        :class="{ 'is-today': d.today, 'is-active': d.key === activeDate }"
        @click="onDateClick(d)"
      >{{ d.label }}</span>
    </div>
    <section v-if="preview.length" class="section">
      <header class="sec-head"><h3>更新预告</h3><span>更多></span></header>
      <div class="comic-scroll">
        <article v-for="(c, i) in preview" :key="c.id || 'p-' + i" class="comic-card">
          <CebImg class="comic-card__cover" :path="c.coverLocal || c.cover" />
          <p class="comic-card__type">{{ c.type }} · {{ c.status }}</p>
          <h4>{{ c.title }}</h4>
        </article>
      </div>
    </section>
    <div class="mid-actions">
      <button @click="onClassify">分类</button>
      <button @click="onRecent">最近观看</button>
    </div>
    <p v-if="notice" class="anime-notice">{{ notice }}</p>
    <section v-if="!filteredSections.length && !preview.length" class="section">
      <p class="anime-notice">暂无内容</p>
    </section>
    <section v-for="sec in filteredSections" :key="sec.id || sec.title" class="section">
      <header class="sec-head"><h3>{{ sec.title }}</h3><span>更多></span></header>
      <div class="comic-scroll">
        <article v-for="(c, i) in sec.items" :key="c.id || i" class="comic-card">
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
import {
  fetchHomeComic,
  fetchHomeComicSuper,
  fetchComicList,
  fetchPreviewComics,
} from '../api/comics.js'
import { normalizeComic, mapComicSectionTitle } from '../api/normalize.js'

const tabList = tabsFallback.anime.tabs
const filters = tabsFallback.anime.filters
const active = ref('漫画')
const activeFilter = ref('全部')
const bakedSections = (baked.sections || []).map((s) => ({
  id: s.id || '',
  title: mapComicSectionTitle(s.title),
  items: s.items || [],
}))
const comics = ref(baked.comicsHome?.length ? baked.comicsHome : tabsFallback.anime.comics)
const liveSections = ref(bakedSections)
const previewItems = ref([])
const previewSectionId = ref('')
const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dates = computed(() => {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - 3 + i)
    const today = i === 3
    return {
      key: ymd(d),
      label: `${String(d.getDate()).padStart(2, '0')} ${today ? '今日' : week[d.getDay()]}`,
      today,
      date: d,
    }
  })
})

const activeDate = ref(ymd(new Date()))
const notice = ref('')
const filtersEl = ref(null)
let noticeTimer = null

function showNotice(msg) {
  notice.value = msg
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 2200)
}

function matchFilter(item) {
  if (!item) return false
  if (activeFilter.value === '全部') return true
  const hay = `${item.type || ''} ${item.title || ''} ${item.status || ''}`
  return hay.includes(activeFilter.value)
}

const preview = computed(() => {
  const list = previewItems.value.length
    ? previewItems.value
    : liveSections.value.find((s) => s.title === '更新预告')?.items || comics.value.slice(0, 4)
  return list.filter(matchFilter)
})

const sections = computed(() => {
  const rest = liveSections.value.filter((s) => s.title !== '更新预告')
  if (rest.length) return rest
  const list = comics.value
  return [
    { title: '韩漫', items: list.slice(0, 10) },
    { title: '同人', items: list.slice(2, 8) },
  ]
})

const filteredSections = computed(() =>
  sections.value
    .map((sec) => ({ ...sec, items: (sec.items || []).filter(matchFilter) }))
    .filter((sec) => sec.items.length > 0),
)

function onFilterTool() {
  filtersEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  showNotice('请选择下方筛选标签')
}

function onBookshelf() {
  showNotice('书架暂无收藏')
}

function onClassify() {
  filtersEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  if (activeFilter.value === '全部' && filters.length > 1) activeFilter.value = filters[1]
  showNotice(`已切换分类：${activeFilter.value}`)
}

function onRecent() {
  showNotice('暂无最近观看记录')
}

async function expandSection(sec) {
  if (!sec?.id) return sec
  try {
    const raw = await fetchComicList(sec.id, { page: 1, pageSize: 10, isMore: false })
    const data = raw.data ?? raw
    const list = (Array.isArray(data) ? data : data?.list || data?.comics || [])
      .map(normalizeComic)
      .filter(Boolean)
    if (list.length) return { ...sec, items: list }
  } catch {}
  return sec
}

async function loadPreview(id, searchDate) {
  if (!id) return
  try {
    const raw = await fetchPreviewComics(id, { page: 1, searchDate })
    const data = raw.data ?? raw
    const list = (Array.isArray(data) ? data : data?.list || data?.comics || [])
      .map(normalizeComic)
      .filter(Boolean)
    if (list.length) previewItems.value = list
  } catch {}
}

function onDateClick(d) {
  activeDate.value = d.key
  if (previewSectionId.value) loadPreview(previewSectionId.value, d.key)
}

async function loadComics() {
  try {
    const raw = await fetchHomeComicSuper()
    const data = raw.data ?? raw
    const list = Array.isArray(data) ? data : []
    if (list.length) {
      const mapped = list.map((s) => ({
        id: s.id || s.flagId || s.sectionId || '',
        flagName: s.flagName || s.name || '',
        title: mapComicSectionTitle(s.flagName || s.name),
        items: (s.comicList || s.list || []).map(normalizeComic).filter(Boolean),
      }))

      const previewSec = mapped.find((s) => s.title === '更新预告') || mapped[0]
      previewSectionId.value = previewSec?.id || ''
      if (previewSectionId.value) {
        await loadPreview(previewSectionId.value, activeDate.value)
      }

      const expanded = await Promise.all(
        mapped.map(async (sec) => {
          if (sec.title === '更新预告') return sec
          return expandSection(sec)
        }),
      )
      liveSections.value = expanded
      const flat = expanded.flatMap((s) => s.items)
      if (flat.length) comics.value = flat
      return
    }
  } catch {}

  try {
    const raw = await fetchHomeComic({ tab: active.value })
    const data = raw.data ?? raw
    const list = (data?.comics || data?.list || [])
      .map(normalizeComic)
      .filter((c) => c?.title && c.title.length > 1 && !/全部|主题|分类|最近/.test(c.title))
    if (list.length >= 3) comics.value = list
  } catch {
    comics.value = baked.comicsHome?.length ? baked.comicsHome : tabsFallback.anime.comics
    liveSections.value = bakedSections
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
.date { color: rgba(255,255,255,.45); font-size: 0.26rem; padding: 0.08rem 0.12rem; cursor: pointer; }
.date.is-today, .date.is-active { background: #f81942; border-radius: 50%; color: #fff; }
.mid-actions { display: flex; gap: 0.16rem; padding: 0 0.32rem 0.24rem; }
.mid-actions button {
  background: #f81942; border: none; border-radius: 0.8rem; color: #fff; flex: 1; font-size: 0.32rem; padding: 0.16rem;
}
.anime-notice {
  color: rgba(255,255,255,.65); font-size: 0.28rem; padding: 0 0.32rem 0.16rem; text-align: center;
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
