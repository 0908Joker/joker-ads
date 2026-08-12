<template>
  <TabShell active="circle">
    <SearchBar />
    <h2 class="page-title">热门圈子</h2>

    <section class="topic-card">
      <div class="topic-card__left">
        <p class="topic-label">今日热门话题</p>
        <span class="topic-issue">第一百零五期</span>
        <h3>{{ topic.title.replace('第一百零五期 ', '') }}</h3>
      </div>
      <div class="topic-card__right">
        <p>参与话题 {{ topic.participants }}</p>
        <p class="topic-sub">当前参与人数</p>
        <div class="poll">
          <i class="poll__pro" :style="{ width: topic.pro }" />
          <i class="poll__con" :style="{ width: topic.con }" />
        </div>
        <div class="poll-labels"><span>正方 {{ topic.pro }}</span><span>反方 {{ topic.con }}</span></div>
      </div>
    </section>

    <div class="notice">参与每日热门话题讨论，赢大奖，更有机会成为官方特邀嘉宾!</div>

    <section class="groups">
      <header class="sec-head"><h3>热门圈子</h3><span>更多 ></span></header>
      <div class="group-grid">
        <div v-for="g in groups" :key="g.name" class="group-item">
          <strong>{{ g.name }}</strong>
          <span>{{ g.count }}</span>
        </div>
      </div>
    </section>

    <section class="posts">
      <article v-for="(p, i) in posts" :key="i" class="post">
        <div class="post-head">
          <div class="post-avatar">小红书</div>
          <div class="post-who">
            <strong>{{ p.user }}</strong>
            <span>{{ p.time }}</span>
          </div>
          <button class="btn-ghost">私信</button>
          <button class="btn-solid">关注</button>
        </div>
        <p class="post-title"><span v-if="p.pinned" class="pin">置顶</span>{{ p.title }}</p>
        <span v-if="p.tag" class="post-tag">{{ p.tag }}</span>
        <p class="post-stats">{{ p.likes ?? 115 }} {{ p.comments ?? 32 }} {{ p.views ?? '118697' }}</p>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { computed } from 'vue'
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import tabsFallback from '../data/tabs.json'

const topic = tabsFallback.circle.topic
const groups = computed(() => {
  const g = tabsFallback.circle.groups
  return g.length >= 8 ? g : [...g, { name: '巨乳', count: '3138个帖子' }]
})
const posts = computed(() => tabsFallback.circle.posts)
</script>

<style scoped>
.page-title { font-size: 0.4rem; padding: 0.08rem 0.32rem 0.16rem; }
.topic-card {
  background: linear-gradient(90deg, #4a2030 0%, #c45c2a 100%);
  border-radius: 0.2rem; display: flex; gap: 0.2rem; margin: 0 0.32rem 0.2rem; overflow: hidden; padding: 0.28rem;
}
.topic-card__left { flex: 1.2; }
.topic-label { color: #ffd36a; font-size: 0.26rem; }
.topic-issue { background: rgba(0,0,0,.35); border-radius: 0.8rem; display: inline-block; font-size: 0.22rem; margin-top: 0.08rem; padding: 0.04rem 0.12rem; }
.topic-card h3 { font-size: 0.34rem; line-height: 1.35; margin-top: 0.12rem; }
.topic-card__right { flex: 1; font-size: 0.26rem; }
.topic-sub { color: rgba(255,255,255,.7); font-size: 0.22rem; margin: 0.08rem 0; }
.poll { border-radius: 0.8rem; display: flex; height: 0.16rem; overflow: hidden; }
.poll__pro { background: #5ad0e6; display: block; }
.poll__con { background: #f39c12; display: block; }
.poll-labels { display: flex; font-size: 0.22rem; justify-content: space-between; margin-top: 0.08rem; }
.notice {
  background: #f81942; color: #fff; font-size: 0.26rem; margin: 0 0.32rem 0.24rem; padding: 0.16rem 0.24rem;
}
.groups { padding: 0 0.32rem; }
.sec-head { align-items: center; display: flex; justify-content: space-between; margin-bottom: 0.16rem; }
.sec-head h3 { font-size: 0.36rem; }
.sec-head span { color: #f81942; font-size: 0.28rem; }
.group-grid { display: grid; gap: 0.12rem; grid-template-columns: repeat(3, 1fr); }
.group-item {
  background: #1a1a1a; border-radius: 0.12rem; min-height: 1.6rem; padding: 0.2rem;
}
.group-item strong { display: block; font-size: 0.3rem; }
.group-item span { color: rgba(255,255,255,.5); font-size: 0.24rem; }
.posts { padding: 0.32rem; }
.post { border-bottom: 1px solid rgba(255,255,255,.06); margin-bottom: 0.28rem; padding-bottom: 0.28rem; }
.post-head { align-items: center; display: flex; gap: 0.12rem; }
.post-avatar {
  align-items: center; background: #f81942; border-radius: 50%; display: flex; font-size: 0.18rem;
  height: 0.8rem; justify-content: center; width: 0.8rem;
}
.post-who { flex: 1; min-width: 0; }
.post-who strong { display: block; font-size: 0.3rem; }
.post-who span { color: rgba(255,255,255,.45); font-size: 0.24rem; }
.btn-ghost { background: none; border: 1px solid #f81942; border-radius: 0.8rem; color: #f81942; font-size: 0.24rem; padding: 0.06rem 0.16rem; }
.btn-solid { background: #f81942; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.24rem; padding: 0.06rem 0.16rem; }
.post-title { font-size: 0.32rem; line-height: 1.45; margin-top: 0.16rem; }
.pin { background: #f81942; border-radius: 0.06rem; font-size: 0.22rem; margin-right: 0.08rem; padding: 0.02rem 0.08rem; }
.post-tag { color: #7ecbff; font-size: 0.28rem; }
.post-stats { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.12rem; }
</style>
