<template>
  <TabShell active="featured">
    <header class="top-search">
      <div class="tags-scroll">
        <span v-for="t in ['美女', '巨乳', '奶子', '帅哥']" :key="t" class="tag">{{ t }}</span>
      </div>
    </header>
    <nav class="cat-tabs">
      <button v-for="tab in data.tabs" :key="tab" class="cat-tab" :class="{ 'is-active': activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
    </nav>
    <div class="chips">
      <span v-for="c in data.chips" :key="c" class="chip">{{ c }}</span>
    </div>
    <div class="sub-tabs">
      <button v-for="s in data.subTabs" :key="s" class="sub-tab" :class="{ 'is-active': subTab === s }">{{ s }}</button>
      <span class="more">最新影片 更多</span>
    </div>
    <section class="video-list">
      <article v-for="(v, i) in data.videos" :key="i" class="video-card">
        <div class="cover" />
        <div class="meta">
          <h3>{{ v.title }}</h3>
          <p>{{ v.views }} · {{ v.duration }}</p>
        </div>
      </article>
      <div class="ad-card">
        <strong>{{ data.ad.name }}</strong>
        <span>{{ data.ad.viewers }}</span>
        <button>查看</button>
      </div>
    </section>
  </TabShell>
</template>

<script setup>
import { ref } from 'vue'
import TabShell from '../components/TabShell.vue'
import tabs from '../data/tabs.json'

const data = tabs.featured
const activeTab = ref('推荐')
const subTab = ref('推荐')
</script>

<style scoped>
.top-search { padding: 0.24rem 0.32rem 0; }
.tags-scroll { display: flex; gap: 0.24rem; overflow-x: auto; color: rgba(255,255,255,.7); font-size: 0.32rem; }
.cat-tabs { display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.24rem 0.32rem; white-space: nowrap; }
.cat-tab { background: none; border: none; color: rgba(255,255,255,.65); font-size: 0.4rem; padding-bottom: 0.12rem; }
.cat-tab.is-active { color: #ff2d55; font-weight: 600; border-bottom: 2px solid #ff2d55; }
.chips { display: flex; flex-wrap: wrap; gap: 0.16rem; padding: 0 0.32rem 0.24rem; }
.chip { background: rgba(255,45,85,.15); border-radius: 0.8rem; color: #ffb3c6; font-size: 0.28rem; padding: 0.08rem 0.2rem; }
.sub-tabs { align-items: center; display: flex; gap: 0.32rem; padding: 0 0.32rem 0.24rem; }
.sub-tab { background: none; border: none; color: rgba(255,255,255,.55); font-size: 0.36rem; }
.sub-tab.is-active { color: #fff; font-weight: 600; }
.more { color: rgba(255,255,255,.45); font-size: 0.28rem; margin-left: auto; }
.video-list { padding: 0 0.32rem; }
.video-card { background: #1a1a1a; border-radius: 0.16rem; display: flex; gap: 0.24rem; margin-bottom: 0.24rem; padding: 0.24rem; }
.cover { background: linear-gradient(135deg,#333,#111); border-radius: 0.12rem; flex-shrink: 0; height: 1.6rem; width: 2.4rem; }
.meta h3 { color: #eee; font-size: 0.32rem; line-height: 1.4; }
.meta p { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.12rem; }
.ad-card { align-items: center; background: linear-gradient(90deg,#2a1810,#1a1a1a); border-radius: 0.16rem; display: flex; gap: 0.16rem; margin: 0.24rem 0; padding: 0.24rem; }
.ad-card strong { color: #ffd700; flex: 1; }
.ad-card span { color: rgba(255,255,255,.5); font-size: 0.26rem; }
.ad-card button { background: #ff2d55; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.28rem; padding: 0.12rem 0.32rem; }
</style>
