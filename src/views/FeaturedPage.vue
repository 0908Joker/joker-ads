<template>
  <TabShell active="featured">
    <header class="feat-head">
      <span class="feat-head__tee" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8">
          <path d="M8 7l-3 2v10h14V9l-3-2" />
          <path d="M8 7V5h8v2" />
        </svg>
      </span>
      <SearchBar class="feat-head__search" to="/searchPage" />
      <span class="feat-head__hist">⏱</span>
      <span class="feat-head__plus">＋</span>
    </header>

    <nav class="cat-tabs">
      <button
        v-for="tab in CATEGORY_TABS"
        :key="tab"
        class="cat-tab"
        :class="{ 'is-active': activeTab === tab }"
        @click="activeTab = tab"
      >{{ tab }}</button>
    </nav>

    <div class="sub-tabs">
      <button
        v-for="s in subTabs"
        :key="s"
        class="sub-tab"
        :class="{ 'is-active': subTab === s }"
        @click="subTab = s"
      >{{ s }}</button>
      <span class="more">最新影片 更多</span>
    </div>

    <section class="video-list">
      <article
        v-for="(v, i) in videos"
        :key="v.id || i"
        class="video-row"
        :class="{
          'video-row--ad': v.isAd,
          'video-row--video': !v.isAd,
          'video-row--tap': !v.isAd && v.id,
        }"
        @click="openVideo(v)"
      >
        <template v-if="v.isAd">
          <div class="video-row__cover video-row__cover--ad">广告</div>
          <div class="video-row__body">
            <h3>{{ adCard.name }}</h3>
            <p class="video-row__meta">{{ adCard.viewers }} · <span class="video-row__link">查看</span></p>
          </div>
        </template>
        <template v-else>
          <CebImg class="video-row__cover" :path="v.coverLocal || v.cover" />
          <div class="video-row__body">
            <h3>{{ v.title }}</h3>
            <p class="video-row__stats">{{ v.views }} · {{ v.duration }}</p>
          </div>
        </template>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import videoCategories from '../data/video-categories.json'
import { fetchRecommend } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'

const FALLBACK_TABS = [
  '最新', '推荐', '夏日限定', '18岁', '制服', '探花', '原创', '乱伦', '国产', '传媒', '日本', '欧美', '同性',
]
const CATEGORY_TABS =
  (videoCategories.categories || []).map((c) => c.name).filter(Boolean).length
    ? (videoCategories.categories || []).map((c) => c.name).filter(Boolean)
    : FALLBACK_TABS
const subTabs = tabsFallback.featured.subTabs
const PAGE_SIZE = 24

/**
 * The origin answers 0 videos for every `categories/{id}` and `tag/videos/name`
 * request on our token, so there is no per-category feed to read. Slice a baked
 * pool instead so every tab shows different titles rather than nothing.
 *
 * The pool is ~316 KB, which would double the entry bundle, so it loads as its
 * own chunk; until it lands the smaller snapshot in live-api.json fills in.
 */
const pool = ref([])
const seed = normalizeFeaturedPayload(liveApi.featured)

function poolSlice(tab, sub) {
  const source = pool.value.length ? pool.value : seed
  if (!source.length) return []
  if (source.length <= PAGE_SIZE) return source
  const tabIndex = Math.max(0, CATEGORY_TABS.indexOf(tab))
  const subIndex = Math.max(0, subTabs.indexOf(sub))
  const start = ((tabIndex * subTabs.length + subIndex) * PAGE_SIZE) % source.length
  const slice = source.slice(start, start + PAGE_SIZE)
  return slice.length === PAGE_SIZE
    ? slice
    : [...slice, ...source.slice(0, PAGE_SIZE - slice.length)]
}

const sqAd = tabsFallback.featured.ad || {}

const router = useRouter()
const activeTab = ref('推荐')
const subTab = ref('推荐')
const videos = ref(withAdSlot(poolSlice('推荐', '推荐')))

function openVideo(v) {
  if (v.isAd || !v.id) return
  router.push(`/play/${v.id}`)
}

const adCard = computed(() => ({
  name: sqAd.name || '真实直播偷拍迷奸',
  viewers: sqAd.viewers || '6864人 正在看',
}))

function withAdSlot(list) {
  const out = [...list]
  if (out.length >= 4) out.splice(4, 0, { isAd: true, id: 'sq-ad' })
  return out
}

function cachedFeaturedForTab(tab, sub) {
  const byCat = liveApi.featuredByCat || {}
  if (byCat[tab] && !byCat[tab].error) {
    const list = normalizeFeaturedPayload(byCat[tab])
    if (list.length) return list
  }
  return poolSlice(tab, sub)
}

function tabPageOffset(tab) {
  const idx = CATEGORY_TABS.indexOf(tab)
  return idx >= 0 ? idx + 1 : 1
}

function subTabPageBump(sub) {
  if (sub === '最新') return 1
  if (sub === '最热') return 2
  return 0
}

function sortFeaturedList(list, sub) {
  if (sub !== '最热' || list.length < 2) return list
  return [...list].sort((a, b) => {
    const av = Number(String(a.views || '0').replace(/[^\d.]/g, '')) || 0
    const bv = Number(String(b.views || '0').replace(/[^\d.]/g, '')) || 0
    return bv - av
  })
}

// Guards against a slow response for a previous tab overwriting the current one.
let loadToken = 0

async function loadVideos() {
  const tab = activeTab.value
  const sub = subTab.value
  const token = ++loadToken

  // Render immediately; a live response upgrades this in place if one arrives.
  videos.value = withAdSlot(cachedFeaturedForTab(tab, sub))

  try {
    const sort = sub === '最新' ? 'latest' : sub === '最热' ? 'hot' : 'recommend'
    const raw = await fetchRecommend({
      page: tabPageOffset(tab) + subTabPageBump(sub),
      pageSize: 20,
      sort,
    })
    if (token !== loadToken) return
    const list = sortFeaturedList(normalizeFeaturedPayload(raw.data ?? raw), sub)
    if (list.length) videos.value = withAdSlot(list)
  } catch {
    // Keep whatever the pool already rendered.
  }
}

watch([activeTab, subTab], () => loadVideos(), { immediate: true })

onMounted(async () => {
  try {
    const mod = await import('../data/video-pool.json')
    pool.value = normalizeFeaturedPayload({ videos: mod.default.videos })
    loadVideos()
  } catch {
    // Seed data already covers the tabs.
  }
})
</script>

<style scoped>
.feat-head {
  align-items: center;
  display: flex;
  gap: 0.12rem;
  padding: 0.12rem 0.2rem 0;
}
.feat-head__tee,
.feat-head__hist,
.feat-head__plus {
  align-items: center;
  color: #fff;
  display: flex;
  flex-shrink: 0;
  font-size: 0.4rem;
  height: 0.64rem;
  justify-content: center;
  width: 0.64rem;
}
:deep(.feat-head__search.search-bar),
.feat-head :deep(.search-bar) {
  flex: 1;
  margin: 0;
}
.cat-tabs {
  display: flex; gap: 0.28rem; overflow-x: auto; padding: 0.08rem 0.32rem 0.16rem; white-space: nowrap;
}
.cat-tab {
  background: none; border: none; color: rgba(255,255,255,.7); font-size: 0.36rem; padding: 0.08rem 0.2rem; border-radius: 0.8rem;
  position: relative;
}
.cat-tab.is-active { background: #fff; color: #111; font-weight: 600; }
.sub-tabs { align-items: center; display: flex; gap: 0.32rem; padding: 0.12rem 0.32rem 0.2rem; }
.sub-tab {
  background: rgb(44, 44, 47); border: none; border-radius: 0.8rem; color: rgba(255,255,255,.55);
  font-size: 0.3rem; padding: 0.08rem 0.22rem;
}
.sub-tab.is-active { background: #f81942; color: #fff; font-weight: 600; }
.more { color: rgba(255,255,255,.45); font-size: 0.28rem; margin-left: auto; }
.video-list {
  display: grid;
  gap: 0.2rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0 0.30769rem 0.32rem;
}
.video-row {
  background: #1a1a1a;
  border-radius: 0.12rem;
  min-width: 0;
  overflow: hidden;
}
.video-row--video {
  display: flex;
  flex-direction: column;
}
.video-row--tap {
  cursor: pointer;
}
.video-row--tap:active {
  opacity: 0.75;
}
.video-row--video :deep(.video-row__cover) {
  aspect-ratio: 3 / 2;
  border-radius: 0.1rem 0.1rem 0 0;
  flex-shrink: 0;
  height: auto;
  overflow: hidden;
  width: 100%;
}
.video-row--video .video-row__body {
  padding: 0.14rem 0.16rem 0.16rem;
}
.video-row--ad {
  align-items: center;
  display: flex;
  gap: 0.2rem;
  grid-column: 1 / -1;
  height: 2.07692rem;
  padding: 0.2rem;
}
.video-row--ad .video-row__cover {
  border-radius: 0.1rem; flex-shrink: 0; height: 1.58974rem; overflow: hidden; width: 2.41026rem;
}
.video-row__cover--ad {
  align-items: center; background: linear-gradient(135deg,#3a2030,#1a1a1a); color: #ff6b8a;
  display: flex; font-size: 0.26rem; justify-content: center;
}
.video-row__body { flex: 1; min-width: 0; }
.video-row__body h3 {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; display: -webkit-box;
  line-height: 1.35; overflow: hidden;
}
.video-row--video .video-row__body h3 {
  font-size: 0.28rem;
  min-height: 2.7em;
}
.video-row--ad .video-row__body h3 {
  font-size: 0.32rem;
}
.video-row__stats {
  color: rgba(255,255,255,.45);
  font-size: 0.24rem;
  margin-top: 0.08rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.video-row__meta { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.08rem; }
.video-row__link { color: #7ecbff; }
</style>
