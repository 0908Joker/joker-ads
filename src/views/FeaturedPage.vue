<template>
  <TabShell active="featured">
    <header class="search-bar">
      <span class="search-bar__icon">🔍</span>
      <div class="search-bar__words">
        <span v-for="w in hotWords" :key="w" class="search-bar__word">{{ w }}</span>
      </div>
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
      <span class="filter-row__label">快速筛选</span>
      <span class="filter-row__expand">展开</span>
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
        :class="{ 'video-row--ad': v.isAd }"
      >
        <template v-if="v.isAd">
          <div class="video-row__cover video-row__cover--ad">广告</div>
          <div class="video-row__body">
            <p class="video-row__stats"><span>SQ直播</span></p>
            <h3>{{ adCard.name }}</h3>
            <p class="video-row__meta">{{ adCard.viewers }} · <button class="video-row__link">查看</button></p>
          </div>
        </template>
        <template v-else>
          <img v-if="v.cover || v.coverLocal" :src="v.coverLocal || v.cover" alt="" class="video-row__cover" />
          <div v-else class="video-row__cover video-row__cover--ph" />
          <div class="video-row__body">
            <p class="video-row__stats"><span>{{ v.views }}</span><span>{{ v.duration }}</span></p>
            <h3>{{ v.title }}</h3>
          </div>
        </template>
      </article>
      <p v-if="loading" class="video-list__loading">加载中…</p>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import { fetchRecommend, fetchVideoFilter } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'
import { cleanFeedList } from '../composables/useApiFeed.js'

const CATEGORY_TABS = [
  '最新',
  '推荐',
  '夏日限定',
  '18岁',
  '制服',
  '探花',
  '原创',
  '乱伦',
  '国产',
  '传媒',
  '日本',
  '欧美',
  '同性',
]

const chips = tabsFallback.featured.chips
const subTabs = tabsFallback.featured.subTabs
const hotWords = ['美女', '巨乳', '奶子', '帅哥']

const fallbackVideos = cleanFeedList(
  normalizeFeaturedPayload(liveApi.featured).length
    ? normalizeFeaturedPayload(liveApi.featured)
    : feeds.featured?.videos?.length
      ? feeds.featured.videos
      : tabsFallback.featured.videos,
)

const sqAd = tabsFallback.featured.ad || {}

const activeTab = ref('推荐')
const subTab = ref('推荐')
const videos = ref([])
const loading = ref(false)

const adCard = computed(() => ({
  name: sqAd.name || 'SQ直播',
  viewers: sqAd.remark?.match(/\d+人[^·]*/)?.[0] || '5362人 正在看',
}))

function withAdSlot(list) {
  const out = [...list]
  if (out.length >= 4) out.splice(4, 0, { isAd: true, id: 'sq-ad' })
  return out
}

async function loadVideos() {
  loading.value = true
  try {
    const tab = activeTab.value
    const sort = subTab.value === '最新' ? 'new' : subTab.value === '最热' ? 'hot' : 'recommend'
    const raw =
      tab === '推荐'
        ? await fetchRecommend({ page: 1, pageSize: 20, sort })
        : await fetchVideoFilter({ category: tab, page: 1, pageSize: 20, sort })
    const list = normalizeFeaturedPayload(raw.data ?? raw)
    videos.value = withAdSlot(list.length ? list : fallbackVideos)
  } catch {
    videos.value = withAdSlot(fallbackVideos)
  } finally {
    loading.value = false
  }
}

watch([activeTab, subTab], () => loadVideos(), { immediate: true })
</script>

<style scoped>
.search-bar {
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  display: flex;
  gap: 0.16rem;
  margin: 0.24rem 0.32rem;
  padding: 0.16rem 0.24rem;
}
.search-bar__icon { font-size: 0.32rem; opacity: 0.6; }
.search-bar__words { display: flex; gap: 0.24rem; overflow-x: auto; white-space: nowrap; }
.search-bar__word { color: rgba(255,255,255,.55); font-size: 0.28rem; }
.cat-tabs {
  display: flex; gap: 0.32rem; overflow-x: auto; padding: 0.16rem 0.32rem; white-space: nowrap;
}
.cat-tab {
  background: none; border: none; color: rgba(255,255,255,.65); font-size: 0.4rem; padding: 0.08rem 0.16rem; border-radius: 0.8rem;
}
.cat-tab.is-active { background: rgba(255,255,255,.92); color: #111; font-weight: 600; }
.filter-row {
  align-items: center; color: rgba(255,255,255,.45); display: flex; font-size: 0.28rem;
  justify-content: space-between; padding: 0.08rem 0.32rem;
}
.chips { display: flex; flex-wrap: wrap; gap: 0.16rem; padding: 0 0.32rem 0.2rem; }
.chip {
  background: rgb(44, 44, 47); border-radius: 0.8rem; color: rgb(153, 153, 153);
  font-size: 0.28rem; padding: 0.12rem 0.24rem;
}
.sub-tabs { align-items: center; display: flex; gap: 0.32rem; padding: 0 0.32rem 0.24rem; }
.sub-tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.36rem; }
.sub-tab.is-active { color: #fff; font-weight: 600; }
.more { color: rgba(255,255,255,.45); font-size: 0.28rem; margin-left: auto; }
.video-list { padding: 0 0.24rem 0.32rem; }
.video-row {
  align-items: center; display: flex; gap: 0.24rem; margin-bottom: 0.24rem; min-height: 1.62rem;
}
.video-row__cover {
  border-radius: 0.12rem; flex-shrink: 0; height: 1.62rem; object-fit: cover; width: 2.88rem;
}
.video-row__cover--ph { background: linear-gradient(135deg,#333,#111); }
.video-row__cover--ad {
  align-items: center; background: linear-gradient(135deg,#2a1520,#111); color: #ff6b8a;
  display: flex; font-size: 0.28rem; justify-content: center;
}
.video-row__body { flex: 1; min-width: 0; }
.video-row__stats {
  color: rgba(255,255,255,.45); display: flex; font-size: 0.26rem; gap: 0.16rem; margin-bottom: 0.08rem;
}
.video-row__body h3 {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; display: -webkit-box;
  font-size: 0.32rem; line-height: 1.35; overflow: hidden;
}
.video-row__meta { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.08rem; }
.video-row__link { background: none; border: none; color: #7ecbff; font-size: 0.26rem; }
.video-list__loading { color: rgba(255,255,255,.45); font-size: 0.28rem; padding: 0.24rem; text-align: center; }
</style>
