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
        v-for="tab in tabs"
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
      <button v-for="s in subTabs" :key="s" class="sub-tab" :class="{ 'is-active': subTab === s }" @click="subTab = s">{{ s }}</button>
      <span class="more">最新影片 更多</span>
    </div>

    <section class="video-feed">
      <article v-if="heroVideo" class="video-hero">
        <img v-if="heroVideo.coverLocal" :src="heroVideo.coverLocal" alt="" class="video-hero__cover" />
        <div v-else class="video-hero__cover video-hero__cover--ph" />
        <div class="video-hero__meta">
          <h3>{{ heroVideo.title }}</h3>
          <p>{{ heroVideo.views }} · {{ heroVideo.duration }}</p>
        </div>
      </article>
      <div class="video-grid">
        <article v-for="(v, i) in gridVideos" :key="i" class="video-grid__item">
          <img v-if="v.coverLocal" :src="v.coverLocal" alt="" class="video-grid__cover" />
          <div v-else class="video-grid__cover video-grid__cover--ph" />
          <h3>{{ v.title }}</h3>
          <p>{{ v.views }} · {{ v.duration }}</p>
        </article>
      </div>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'

const raw = feeds.featured?.videos || []
const clean = raw
  .map((v) => ({
    ...v,
    title: v.title?.replace(/\s+/g, ' ').trim(),
  }))
  .filter((v) => v.title && v.title.length > 6 && !/快速筛选|广告 SQ|^\d/.test(v.title))

const videos = clean.length ? clean : tabsFallback.featured.videos
const tabs = feeds.featured?.tabs?.length ? feeds.featured.tabs : tabsFallback.featured.tabs
const chips = tabsFallback.featured.chips
const subTabs = tabsFallback.featured.subTabs
const hotWords = ['美女', '巨乳', '奶子', '帅哥']

const activeTab = ref('推荐')
const subTab = ref('推荐')
const heroVideo = computed(() => videos[0])
const gridVideos = computed(() => videos.slice(1))
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
.video-feed { padding: 0 0.16rem 0.32rem; }
.video-hero { margin-bottom: 0.24rem; }
.video-hero__cover { border-radius: 0.16rem; display: block; height: 5.4rem; object-fit: cover; width: 100%; }
.video-hero__cover--ph { background: linear-gradient(135deg,#333,#111); }
.video-hero__meta h3 { font-size: 0.34rem; line-height: 1.4; margin-top: 0.12rem; padding: 0 0.16rem; }
.video-hero__meta p { color: rgba(255,255,255,.45); font-size: 0.26rem; padding: 0 0.16rem; }
.video-grid { display: grid; gap: 0.2rem; grid-template-columns: repeat(2, 1fr); }
.video-grid__cover { aspect-ratio: 16/10; border-radius: 0.12rem; object-fit: cover; width: 100%; }
.video-grid__cover--ph { background: linear-gradient(135deg,#2a2a2a,#111); }
.video-grid__item h3 { font-size: 0.28rem; line-height: 1.35; margin-top: 0.08rem; padding: 0 0.08rem; }
.video-grid__item p { color: rgba(255,255,255,.45); font-size: 0.24rem; padding: 0 0.08rem 0.16rem; }
</style>
