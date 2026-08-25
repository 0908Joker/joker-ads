<template>
  <TabShell active="featured">
    <header class="feat-head">
      <span class="feat-head__tee" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8">
          <path d="M8 7l-3 2v10h14V9l-3-2" />
          <path d="M8 7V5h8v2" />
        </svg>
      </span>
      <SearchBar class="feat-head__search" />
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

    <div class="filter-row">
      <span>快速筛选</span>
      <span>展开</span>
    </div>

    <div class="chips">
      <span v-for="c in chips" :key="c" class="chip">{{ c }}</span>
    </div>

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
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import videoCategories from '../data/video-categories.json'
import { fetchRecommend, fetchAlgoRecommendList, fetchTagVideosByName } from '../api/videos.js'
import { normalizeFeaturedPayload, normalizeAlgoFeaturedPayload } from '../api/normalize.js'
import { cleanFeedList } from '../composables/useApiFeed.js'

const FALLBACK_TABS = [
  '最新', '推荐', '夏日限定', '18岁', '制服', '探花', '原创', '乱伦', '国产', '传媒', '日本', '欧美', '同性',
]
const CATEGORY_TABS =
  (videoCategories.categories || []).map((c) => c.name).filter(Boolean).length
    ? (videoCategories.categories || []).map((c) => c.name).filter(Boolean)
    : FALLBACK_TABS
const chips = tabsFallback.featured.chips
const subTabs = tabsFallback.featured.subTabs
const fallbackVideos = (() => {
  const live = normalizeFeaturedPayload(liveApi.featured)
  if (live.length) return live
  return cleanFeedList(tabsFallback.featured.videos, 4)
})()
const sqAd = tabsFallback.featured.ad || {}

const router = useRouter()
const activeTab = ref('推荐')
const subTab = ref('推荐')
const videos = ref(withAdSlot(fallbackVideos))

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

async function loadVideos() {
  try {
    const tab = activeTab.value
    const cat = (videoCategories.categories || []).find((c) => c.name === tab)
    const sortType = subTab.value === '最新' ? 2 : subTab.value === '最热' ? 3 : 1
    let list = []

    if (tab === '推荐' && sortType === 1) {
      const raw = await fetchRecommend({ page: 1, pageSize: 20, sort: 'recommend' })
      list = normalizeFeaturedPayload(raw.data ?? raw)
    }

    if (!list.length && cat?.id) {
      const raw = await fetchAlgoRecommendList({
        page: 1,
        pageSize: 20,
        categoryId: cat.id,
        categoryKey: cat.id,
        sortType,
      })
      list = normalizeAlgoFeaturedPayload(raw.data ?? raw)
    }

    if (!list.length && cat?.name) {
      const raw = await fetchTagVideosByName({ page: 1, pageSize: 20, name: cat.name })
      list = normalizeFeaturedPayload(raw.data ?? raw)
    }

    if (list.length) videos.value = withAdSlot(list)
    else videos.value = withAdSlot(fallbackVideos)
  } catch {
    videos.value = withAdSlot(fallbackVideos)
  }
}

watch([activeTab, subTab], () => loadVideos(), { immediate: true })
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
.filter-row {
  color: rgba(255,255,255,.45); display: flex; font-size: 0.28rem;
  justify-content: space-between; padding: 0.04rem 0.32rem 0.12rem;
}
.chips { display: flex; flex-wrap: wrap; gap: 0.16rem; padding: 0 0.32rem 0.16rem; }
.chip {
  background: rgb(44, 44, 47); border-radius: 0.8rem; color: rgb(153, 153, 153);
  font-size: 0.28rem; padding: 0.1rem 0.22rem;
}
.sub-tabs { align-items: center; display: flex; gap: 0.32rem; padding: 0 0.32rem 0.2rem; }
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
