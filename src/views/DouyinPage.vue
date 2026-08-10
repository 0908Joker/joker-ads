<template>
  <TabShell active="douyin">
    <nav class="tabs">
      <button v-for="tab in tabList" :key="tab" class="tab" :class="{ 'is-active': active === tab }" @click="active = tab">{{ tab }}</button>
    </nav>
    <section class="short-feed">
      <article v-for="(item, i) in items" :key="i" class="short-slide">
        <img v-if="item.posterLocal" :src="item.posterLocal" alt="" class="short-slide__bg" />
        <div v-else class="short-slide__bg short-slide__bg--ph" />
        <div class="short-slide__overlay">
          <p class="short-slide__user">{{ item.user }}</p>
          <p class="short-slide__title">{{ cleanTitle(item.title) }}</p>
          <div class="short-slide__actions">
            <span>❤ {{ item.likes || '0' }}</span>
            <button>分享</button>
            <button>打赏</button>
            <button>关闭</button>
            <button>客服</button>
          </div>
        </div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'

const tabList = feeds.douyin?.tabs || tabsFallback.douyin.tabs
const active = ref('抖阴')
const items = computed(() => {
  const list = feeds.douyin?.items?.length ? feeds.douyin.items : tabsFallback.douyin.items
  return list
})

function cleanTitle(t) {
  return t?.replace(/\s+/g, ' ').trim().slice(0, 40) || ''
}
</script>

<style scoped>
.tabs {
  display: flex; gap: 0.4rem; left: 0; overflow-x: auto; padding: 0.24rem 0.32rem;
  position: absolute; top: 0; white-space: nowrap; width: 100%; z-index: 2;
}
.tab { background: rgba(0,0,0,.35); border: none; border-radius: 0.8rem; color: rgba(255,255,255,.7); font-size: 0.36rem; padding: 0.1rem 0.24rem; }
.tab.is-active { background: rgba(255,255,255,.15); color: #fff; font-weight: 700; }
.short-feed {
  height: calc(100vh - 1.53846rem - env(safe-area-inset-bottom));
  overflow-y: auto; scroll-snap-type: y mandatory;
}
.short-slide {
  height: calc(100vh - 1.53846rem - env(safe-area-inset-bottom));
  position: relative; scroll-snap-align: start; width: 100%;
}
.short-slide__bg { height: 100%; object-fit: cover; width: 100%; }
.short-slide__bg--ph { background: linear-gradient(180deg,#1a1a1a,#111); height: 100%; width: 100%; }
.short-slide__overlay {
  background: linear-gradient(transparent, rgba(0,0,0,.75)); bottom: 0; left: 0;
  padding: 1rem 0.32rem 0.48rem; position: absolute; right: 0;
}
.short-slide__user { font-size: 0.32rem; font-weight: 600; }
.short-slide__title { font-size: 0.34rem; margin-top: 0.12rem; }
.short-slide__actions {
  align-items: center; display: flex; flex-wrap: wrap; gap: 0.16rem; margin-top: 0.24rem;
}
.short-slide__actions span { color: rgba(255,255,255,.7); font-size: 0.28rem; }
.short-slide__actions button {
  background: rgba(255,255,255,.12); border: none; border-radius: 0.8rem;
  color: #fff; font-size: 0.26rem; padding: 0.08rem 0.2rem;
}
</style>
