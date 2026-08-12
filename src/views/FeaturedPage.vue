<template>
  <TabShell active="featured">
    <SearchBar />

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
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import { fetchRecommend, fetchVideoFilter } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'
import { cleanFeedList } from '../composables/useApiFeed.js'

const CATEGORY_TABS = [
  '最新', '推荐', '夏日限定', '18岁', '制服', '探花', '原创', '乱伦', '国产', '传媒', '日本', '欧美', '同性',
]
const chips = tabsFallback.featured.chips
const subTabs = tabsFallback.featured.subTabs
const fallbackVideos = (() => {
  const live = normalizeFeaturedPayload(liveApi.featured)
  if (live.length) return live
  return cleanFeedList(tabsFallback.featured.videos, 4)
})()
const sqAd = tabsFallback.featured.ad || {}

const activeTab = ref('推荐')
const subTab = ref('推荐')
const videos = ref(withAdSlot(fallbackVideos))

const adCard = computed(() => ({
  name: sqAd.name || 'SQ直播',
  viewers: sqAd.viewers || '5362人 正在看',
}))

function withAdSlot(list) {
  const out = [...list]
  if (out.length >= 3) out.splice(3, 0, { isAd: true, id: 'sq-ad' })
  return out
}

async function loadVideos() {
  try {
    const tab = activeTab.value
    const sort = subTab.value === '最新' ? 'new' : subTab.value === '最热' ? 'hot' : 'recommend'
    const raw =
      tab === '推荐'
        ? await fetchRecommend({ page: 1, pageSize: 20, sort })
        : await fetchVideoFilter({ category: tab, page: 1, pageSize: 20, sort })
    const list = normalizeFeaturedPayload(raw.data ?? raw)
    if (list.length) videos.value = withAdSlot(list)
  } catch {
    videos.value = withAdSlot(fallbackVideos)
  }
}

watch([activeTab, subTab], () => loadVideos(), { immediate: true })
</script>

<style scoped>
.cat-tabs {
  display: flex; gap: 0.28rem; overflow-x: auto; padding: 0.08rem 0.32rem 0.16rem; white-space: nowrap;
}
.cat-tab {
  background: none; border: none; color: rgba(255,255,255,.7); font-size: 0.36rem; padding: 0.08rem 0.2rem; border-radius: 0.8rem;
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
.sub-tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.34rem; }
.sub-tab.is-active { color: #fff; font-weight: 600; }
.more { color: rgba(255,255,255,.45); font-size: 0.28rem; margin-left: auto; }
.video-list { padding: 0 0.30769rem 0.32rem; }
.video-row {
  align-items: center;
  background: #1a1a1a;
  border-radius: 0.12rem;
  display: flex;
  gap: 0.2rem;
  height: 2.07692rem;
  margin-bottom: 0.2rem;
  padding: 0.2rem;
}
.video-row__cover {
  border-radius: 0.1rem; flex-shrink: 0; height: 1.58974rem; overflow: hidden; width: 2.41026rem;
}
:deep(.video-row__cover) {
  border-radius: 0.1rem; flex-shrink: 0; height: 1.58974rem; overflow: hidden; width: 2.41026rem;
}
.video-row__cover--ph { background: linear-gradient(135deg,#3a3a3a,#1a1a1a); }
.video-row__cover--ad {
  align-items: center; background: linear-gradient(135deg,#3a2030,#1a1a1a); color: #ff6b8a;
  display: flex; font-size: 0.26rem; justify-content: center;
}
.video-row__body { flex: 1; min-width: 0; }
.video-row__body h3 {
  -webkit-box-orient: vertical; -webkit-line-clamp: 2; display: -webkit-box;
  font-size: 0.32rem; line-height: 1.35; overflow: hidden;
}
.video-row__stats, .video-row__meta { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.08rem; }
.video-row__link { color: #7ecbff; }
</style>
