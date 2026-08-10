<template>
  <TabShell active="circle">
    <header class="search-bar">美女 巨乳 奶子 帅哥</header>
    <section class="topic-card">
      <p class="topic-label">今日热门话题</p>
      <h2>{{ data.topic.title }}</h2>
      <p class="topic-meta">参与话题 {{ data.topic.participants }} · 正方 {{ data.topic.pro }} · 反方 {{ data.topic.con }}</p>
      <button class="join-btn">参与每日热门话题讨论，赢大奖</button>
    </section>
    <section class="groups">
      <h3>热门圈子 <span>更多 ></span></h3>
      <div class="group-grid">
        <div v-for="g in data.groups" :key="g.name" class="group-item">
          <strong>{{ g.name }}</strong>
          <span>{{ g.count }}</span>
        </div>
      </div>
    </section>
    <section class="posts">
      <article v-for="(p, i) in data.posts" :key="i" class="post">
        <div class="post-head">
          <strong>{{ p.user }}</strong>
          <span>{{ p.time }}</span>
          <span v-if="p.pinned" class="pin">置顶</span>
        </div>
        <p class="post-title">{{ p.title }}</p>
        <span class="post-tag">{{ p.tag }}</span>
        <div class="post-stats">{{ p.likes }} · {{ p.comments }} · {{ p.views }}</div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import TabShell from '../components/TabShell.vue'
import tabs from '../data/tabs.json'

const data = tabs.circle
</script>

<style scoped>
.search-bar { color: rgba(255,255,255,.55); font-size: 0.32rem; padding: 0.32rem; }
.topic-card { background: linear-gradient(135deg,#2a1520,#1a1a1a); border-radius: 0.24rem; margin: 0 0.32rem 0.32rem; padding: 0.32rem; }
.topic-label { color: #ff6b8a; font-size: 0.28rem; }
.topic-card h2 { font-size: 0.38rem; line-height: 1.4; margin-top: 0.12rem; }
.topic-meta { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.16rem; }
.join-btn { background: #ff2d55; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.28rem; margin-top: 0.24rem; padding: 0.16rem 0.32rem; }
.groups { padding: 0 0.32rem; }
.groups h3 { font-size: 0.36rem; margin-bottom: 0.24rem; }
.groups span { color: rgba(255,255,255,.45); font-size: 0.28rem; font-weight: 400; }
.group-grid { display: grid; gap: 0.16rem; grid-template-columns: repeat(2, 1fr); }
.group-item { background: #1a1a1a; border-radius: 0.16rem; padding: 0.24rem; }
.group-item strong { display: block; font-size: 0.32rem; }
.group-item span { color: rgba(255,255,255,.45); font-size: 0.26rem; }
.posts { padding: 0.32rem; }
.post { border-bottom: 1px solid rgba(255,255,255,.06); margin-bottom: 0.32rem; padding-bottom: 0.32rem; }
.post-head { align-items: center; display: flex; flex-wrap: wrap; gap: 0.16rem; }
.post-head strong { font-size: 0.32rem; }
.post-head span { color: rgba(255,255,255,.45); font-size: 0.26rem; }
.pin { background: #ff2d55; border-radius: 0.08rem; color: #fff; font-size: 0.22rem; padding: 0.04rem 0.12rem; }
.post-title { color: rgba(255,255,255,.85); font-size: 0.32rem; line-height: 1.5; margin-top: 0.16rem; }
.post-tag { color: #7ecbff; font-size: 0.28rem; }
.post-stats { color: rgba(255,255,255,.35); font-size: 0.26rem; margin-top: 0.12rem; }
</style>
