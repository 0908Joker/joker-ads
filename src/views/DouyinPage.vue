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
          <div class="drama-card__cover" />
          <p>{{ d.title }}</p>
        </article>
      </div>
    </section>

    <section class="short-feed">
      <article v-for="(item, i) in items" :key="item.id || i" class="short-slide">
        <video
          v-if="item.videoUrl"
          class="short-slide__media"
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
          class="short-slide__media"
        />
        <div v-else class="short-slide__media short-slide__media--ph" />

        <aside class="short-slide__side">
          <div class="side-avatar">
            <span>♥</span>
            <i>+</i>
          </div>
          <div class="side-act"><span>❤</span><small>{{ item.likes || 0 }}</small></div>
          <div class="side-act"><span>💬</span><small>{{ item.comments || 0 }}</small></div>
          <div class="side-act"><span>★</span><small>{{ item.shares || 0 }}</small></div>
          <div class="side-act"><span>↗</span><small>分享</small></div>
          <div class="side-act"><span>¥</span><small>打赏</small></div>
          <div class="side-act"><span>🔇</span><small>关闭</small></div>
          <div class="side-act"><span>🎧</span><small>客服</small></div>
        </aside>

        <div class="short-slide__overlay">
          <p class="short-slide__user">{{ item.user }}</p>
          <p class="short-slide__title">{{ item.title }}</p>
          <div v-if="item.tags?.length" class="short-slide__tags">
            <span v-for="t in item.tags" :key="t">{{ t }}</span>
          </div>
        </div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, watch } from 'vue'
import TabShell from '../components/TabShell.vue'
import tabsFallback from '../data/tabs.json'
import { fetchShortAndImg } from '../api/videos.js'
import { normalizeShortPayload } from '../api/normalize.js'

const tabList = tabsFallback.douyin.tabs
const activeTab = ref('抖阴')
const items = ref(tabsFallback.douyin.items)
const dramaTags = ['#全部', '#玄幻', '#悬疑', '#甜宠', '#总裁', '#穿越', '#逆袭']
const dramaCards = ref([
  { title: '葡萄成熟时 第4集' },
  { title: '纯阳仙体第1集' },
  { title: '错位的爱人01' },
  { title: '废柴杂役第8集' },
])

async function loadShorts() {
  try {
    const raw = await fetchShortAndImg({ page: 1, pageSize: 10, tab: activeTab.value })
    const list = normalizeShortPayload(raw.data ?? raw)
    if (list.length) {
      items.value = list.map((v, i) => ({
        ...v,
        user: v.user && v.user !== '@saixi' ? v.user : tabsFallback.douyin.items[i % 2]?.user,
        tags: v.hashtags?.length ? v.hashtags : tabsFallback.douyin.items[i % 2]?.tags,
        shares: v.shares || tabsFallback.douyin.items[i % 2]?.shares,
      }))
    }
  } catch {
    items.value = tabsFallback.douyin.items
  }
}

watch(activeTab, () => loadShorts(), { immediate: true })
</script>

<style scoped>
.tabs {
  display: flex; gap: 0.36rem; left: 0; overflow-x: auto; padding: 0.24rem 0.32rem;
  position: absolute; top: 0; white-space: nowrap; width: 100%; z-index: 3;
}
.tab { background: none; border: none; color: rgba(255,255,255,.7); font-size: 0.36rem; padding: 0.08rem 0.12rem; }
.tab.is-active { color: #fff; font-weight: 700; }
.drama-panel { background: #111; padding: 1.1rem 0.32rem 0.16rem; position: relative; z-index: 2; }
.hashtag-row { display: flex; gap: 0.16rem; overflow-x: auto; white-space: nowrap; }
.hashtag { background: rgba(255,255,255,.08); border-radius: 0.8rem; color: rgba(255,255,255,.75); font-size: 0.26rem; padding: 0.08rem 0.2rem; }
.drama-scroll { display: flex; gap: 0.16rem; margin-top: 0.16rem; overflow-x: auto; }
.drama-card { flex-shrink: 0; width: 2.2rem; }
.drama-card__cover { aspect-ratio: 3/4; background: #222; border-radius: 0.12rem; }
.drama-card p { font-size: 0.24rem; margin-top: 0.08rem; }
.short-feed {
  height: calc(100vh - 1.53846rem - env(safe-area-inset-bottom));
  overflow-y: auto; scroll-snap-type: y mandatory;
}
.short-slide {
  height: calc(100vh - 1.53846rem - env(safe-area-inset-bottom));
  position: relative; scroll-snap-align: start; width: 100%;
}
.short-slide__media { height: 100%; object-fit: cover; width: 100%; }
.short-slide__media--ph { background: linear-gradient(180deg,#2a2a2a,#111); }
.short-slide__side {
  align-items: center; bottom: 2.4rem; display: flex; flex-direction: column; gap: 0.28rem;
  position: absolute; right: 0.16rem; z-index: 2;
}
.side-avatar {
  align-items: center; background: #ff2d55; border-radius: 50%; display: flex; font-size: 0.32rem;
  height: 0.96rem; justify-content: center; position: relative; width: 0.96rem;
}
.side-avatar i {
  background: #f81942; border-radius: 50%; bottom: -0.12rem; color: #fff; font-size: 0.22rem;
  font-style: normal; height: 0.32rem; line-height: 0.32rem; position: absolute; text-align: center; width: 0.32rem;
}
.side-act { align-items: center; color: #fff; display: flex; flex-direction: column; font-size: 0.28rem; text-shadow: 0 1px 2px #000; }
.side-act small { font-size: 0.22rem; margin-top: 0.04rem; }
.short-slide__overlay {
  background: linear-gradient(transparent, rgba(0,0,0,.72)); bottom: 0; left: 0;
  padding: 1.2rem 1.6rem 0.4rem 0.32rem; position: absolute; right: 0; z-index: 2;
}
.short-slide__user { font-size: 0.34rem; font-weight: 700; }
.short-slide__title { font-size: 0.32rem; margin-top: 0.1rem; }
.short-slide__tags { display: flex; gap: 0.12rem; margin-top: 0.16rem; }
.short-slide__tags span {
  background: rgba(255,255,255,.16); border-radius: 0.8rem; font-size: 0.24rem; padding: 0.06rem 0.16rem;
}
</style>
