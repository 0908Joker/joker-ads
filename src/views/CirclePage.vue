<template>
  <TabShell active="circle">
    <SearchBar />
    <h2 class="page-title">热门圈子</h2>

    <section class="topic-card">
      <img class="topic-card__bg" :src="topic.cover || '/circle/img-00.png'" alt="" />
      <div class="topic-card__left">
        <p class="topic-label">今日热门话题</p>
        <span class="topic-issue">第一百{{ topic.issue }}期</span>
        <h3>{{ topic.title.replace(/^第一百.+期\s*/, '') }}</h3>
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
          <img v-if="g.cover" class="group-item__bg" :src="g.cover" alt="" />
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
        <div v-if="p.images?.length" class="post-imgs">
          <img v-for="(src, j) in p.images" :key="j" :src="src" alt="" />
        </div>
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

const GROUP_COVERS = [
  '/circle/img-01.png',
  '/circle/img-02.png',
  '/circle/img-03.jpg',
  '/circle/img-04.png',
  '/circle/img-05.png',
  '/circle/img-06.png',
  '/circle/img-07.png',
  '/circle/img-08.png',
  '/circle/img-09.png',
]
const POST_IMGS = [
  '/circle/img-10.jpg',
  '/circle/img-11.jpg',
  '/circle/img-12.jpg',
]

const topic = {
  ...tabsFallback.circle.topic,
  cover: '/circle/img-00.png',
}

const groups = computed(() => {
  const g = [...tabsFallback.circle.groups]
  if (!g.some((x) => x.name === '巨乳')) g.push({ name: '巨乳', count: '3138个帖子' })
  return g.slice(0, 9).map((item, i) => ({ ...item, cover: GROUP_COVERS[i] }))
})

const posts = computed(() =>
  tabsFallback.circle.posts.map((p, i) => ({
    ...p,
    images: POST_IMGS.slice(i, i + (p.pinned ? 1 : 1)).filter(Boolean).length
      ? [POST_IMGS[i] || POST_IMGS[0]]
      : [],
  })),
)
</script>

<style scoped>
.page-title { font-size: 0.4rem; padding: 0.08rem 0.32rem 0.16rem; }
.topic-card {
  border-radius: 0.2rem; display: flex; gap: 0.2rem; margin: 0 0.32rem 0.2rem;
  min-height: 2.4rem; overflow: hidden; padding: 0.28rem; position: relative;
}
.topic-card__bg {
  inset: 0; object-fit: cover; position: absolute; width: 100%; height: 100%;
}
.topic-card__left, .topic-card__right { position: relative; z-index: 1; }
.topic-card__left { flex: 1.2; }
.topic-label { color: #ffd36a; font-size: 0.26rem; text-shadow: 0 1px 2px #000; }
.topic-issue { background: rgba(0,0,0,.35); border-radius: 0.8rem; display: inline-block; font-size: 0.22rem; margin-top: 0.08rem; padding: 0.04rem 0.12rem; }
.topic-card h3 { font-size: 0.34rem; line-height: 1.35; margin-top: 0.12rem; text-shadow: 0 1px 2px #000; }
.topic-card__right { flex: 1; font-size: 0.26rem; text-shadow: 0 1px 2px #000; }
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
  border-radius: 0.12rem; min-height: 1.6rem; overflow: hidden; padding: 0.2rem; position: relative;
}
.group-item__bg {
  inset: 0; object-fit: cover; position: absolute; width: 100%; height: 100%;
}
.group-item strong, .group-item span { position: relative; z-index: 1; text-shadow: 0 1px 2px #000; }
.group-item strong { display: block; font-size: 0.3rem; }
.group-item span { color: rgba(255,255,255,.85); font-size: 0.24rem; }
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
.post-imgs { display: grid; gap: 0.08rem; grid-template-columns: 1fr; margin-top: 0.16rem; }
.post-imgs img { border-radius: 0.12rem; display: block; height: 2.4rem; object-fit: cover; width: 100%; }
.post-stats { color: rgba(255,255,255,.45); font-size: 0.26rem; margin-top: 0.12rem; }
</style>
