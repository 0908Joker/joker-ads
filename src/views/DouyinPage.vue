<template>
  <TabShell active="douyin">
    <nav class="tabs">
      <button
        v-for="tab in tabList"
        :key="tab"
        class="tab"
        :class="{ 'is-active': activeTab === tab }"
        @click="activeTab = tab"
      >{{ tab }}</button>
    </nav>

    <section v-if="activeTab === '短剧'" class="drama-panel">
      <div class="hashtag-row">
        <span v-for="h in dramaTags" :key="h" class="hashtag">{{ h }}</span>
      </div>
      <div class="drama-scroll">
        <article v-for="(d, i) in dramaCards" :key="i" class="drama-card">
          <img v-if="d.cover" :src="d.cover" alt="" class="drama-card__cover" />
          <div v-else class="drama-card__cover drama-card__cover--ph" />
          <p>{{ d.title }}</p>
        </article>
      </div>
    </section>

    <section class="short-feed">
      <article v-for="(item, i) in items" :key="item.id || i" class="short-slide">
        <video
          v-if="item.videoUrl"
          class="short-slide__video"
          :src="item.videoUrl"
          :poster="item.cover || item.coverLocal"
          playsinline
          loop
          muted
          autoplay
        />
        <img
          v-else-if="item.cover || item.coverLocal"
          :src="item.coverLocal || item.cover"
          alt=""
          class="short-slide__bg"
        />
        <div v-else class="short-slide__bg short-slide__bg--ph" />
        <div class="short-slide__side">
          <span>❤ {{ item.likes || '0' }}</span>
          <span>💬 {{ item.comments || '0' }}</span>
          <button>分享</button>
        </div>
        <div class="short-slide__overlay">
          <p class="short-slide__user">{{ item.user }}</p>
          <p class="short-slide__title">{{ item.title }}</p>
        </div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, watch } from 'vue'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import { fetchShortAndImg } from '../api/videos.js'
import { normalizeShortPayload } from '../api/normalize.js'

const tabList = feeds.douyin?.tabs || tabsFallback.douyin.tabs
const activeTab = ref('抖阴')
const items = ref([])
const dramaTags = ['#霸道总裁', '#都市情感', '#甜宠', '#复仇']
const dramaCards = ref([])

const fallback = normalizeShortPayload(liveApi.short).length
  ? normalizeShortPayload(liveApi.short)
  : (feeds.douyin?.items || tabsFallback.douyin.items).map((x) => ({
      user: x.user,
      title: x.title,
      coverLocal: x.posterLocal,
      likes: x.likes,
    }))

async function loadShorts() {
  try {
    const raw = await fetchShortAndImg({ page: 1, pageSize: 10, tab: activeTab.value })
    const list = normalizeShortPayload(raw.data ?? raw)
    if (list.length) {
      items.value = list
      dramaCards.value = list.slice(0, 6).map((v) => ({ title: v.title, cover: v.cover || v.coverLocal }))
      return
    }
  } catch {}
  items.value = fallback
  dramaCards.value = fallback.slice(0, 6).map((v) => ({ title: v.title, cover: v.coverLocal }))
}

watch(activeTab, () => loadShorts(), { immediate: true })
</script>

<style scoped>
.tabs {
  display: flex; gap: 0.4rem; left: 0; overflow-x: auto; padding: 0.24rem 0.32rem;
  position: absolute; top: 0; white-space: nowrap; width: 100%; z-index: 3;
}
.tab { background: rgba(0,0,0,.35); border: none; border-radius: 0.8rem; color: rgba(255,255,255,.7); font-size: 0.36rem; padding: 0.1rem 0.24rem; }
.tab.is-active { background: rgba(255,255,255,.15); color: #fff; font-weight: 700; }
.drama-panel { background: #111; padding: 1.1rem 0.32rem 0.16rem; position: relative; z-index: 2; }
.hashtag-row { display: flex; gap: 0.16rem; overflow-x: auto; white-space: nowrap; }
.hashtag { background: rgba(255,255,255,.08); border-radius: 0.8rem; color: rgba(255,255,255,.75); font-size: 0.26rem; padding: 0.08rem 0.2rem; }
.drama-scroll { display: flex; gap: 0.16rem; margin-top: 0.16rem; overflow-x: auto; }
.drama-card { flex-shrink: 0; width: 2.4rem; }
.drama-card__cover { aspect-ratio: 3/4; border-radius: 0.12rem; object-fit: cover; width: 100%; }
.drama-card__cover--ph { background: #222; }
.drama-card p { font-size: 0.24rem; margin-top: 0.08rem; }
.short-feed {
  height: calc(100vh - 1.53846rem - env(safe-area-inset-bottom));
  overflow-y: auto; scroll-snap-type: y mandatory;
}
.short-slide {
  height: calc(100vh - 1.53846rem - env(safe-area-inset-bottom));
  position: relative; scroll-snap-align: start; width: 100%;
}
.short-slide__video, .short-slide__bg { height: 100%; object-fit: cover; width: 100%; }
.short-slide__bg--ph { background: linear-gradient(180deg,#1a1a1a,#111); height: 100%; width: 100%; }
.short-slide__side {
  align-items: center; bottom: 2rem; display: flex; flex-direction: column; gap: 0.24rem;
  position: absolute; right: 0.24rem; z-index: 2;
}
.short-slide__side span { color: rgba(255,255,255,.85); font-size: 0.26rem; }
.short-slide__side button {
  background: rgba(255,255,255,.12); border: none; border-radius: 0.8rem; color: #fff; font-size: 0.24rem; padding: 0.08rem 0.16rem;
}
.short-slide__overlay {
  background: linear-gradient(transparent, rgba(0,0,0,.75)); bottom: 0; left: 0;
  padding: 1rem 0.32rem 0.48rem; position: absolute; right: 0; z-index: 2;
}
.short-slide__user { font-size: 0.32rem; font-weight: 600; }
.short-slide__title { font-size: 0.34rem; margin-top: 0.12rem; }
</style>
