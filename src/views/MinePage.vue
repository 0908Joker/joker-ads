<template>
  <TabShell active="mine">
    <section class="profile">
      <div class="avatar" />
      <div class="info">
        <p class="id">ID: {{ data.user.id }}</p>
        <h2>{{ data.user.name }}</h2>
        <p class="bio">{{ data.user.bio }}</p>
      </div>
      <button class="bind-btn">注册/绑定有礼 1日VIP 去绑定</button>
    </section>
    <div class="stats">
      <div><strong>{{ data.stats.follow }}</strong><span>关注</span></div>
      <div><strong>{{ data.stats.like }}</strong><span>点赞</span></div>
      <div><strong>{{ data.stats.fav }}</strong><span>收藏</span></div>
    </div>
    <section class="task-card">
      <strong>每日任务</strong>
      <p>{{ data.task }}</p>
      <button>立即前往</button>
    </section>
    <section class="quick-apps">
      <div class="quick-scroll">
        <button v-for="app in data.quickApps" :key="app.name" class="quick-app" @click="openApp(app)">
          <div class="icon">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
    </section>
    <section class="services">
      <h3>更多服务</h3>
      <div class="service-grid">
        <button v-for="s in data.services" :key="s" class="service">{{ s }}</button>
      </div>
    </section>
    <p class="version">{{ data.version }}</p>
  </TabShell>
</template>

<script setup>
import TabShell from '../components/TabShell.vue'
import tabs from '../data/tabs.json'

const data = tabs.mine

function openApp(app) {
  const target = app.signUrl || app.url
  if (target?.startsWith('http')) window.open(target, '_blank')
}
</script>

<style scoped>
.profile { align-items: center; display: flex; flex-wrap: wrap; gap: 0.24rem; padding: 0.48rem 0.32rem 0.24rem; }
.avatar { background: linear-gradient(135deg,#ff2d55,#ed2248); border-radius: 50%; height: 1.2rem; width: 1.2rem; }
.info { flex: 1; min-width: 0; }
.id { color: rgba(255,255,255,.45); font-size: 0.26rem; }
.info h2 { font-size: 0.44rem; margin-top: 0.08rem; }
.bio { color: rgba(255,255,255,.55); font-size: 0.28rem; margin-top: 0.08rem; }
.bind-btn { background: rgba(255,45,85,.15); border: 1px solid rgba(255,45,85,.4); border-radius: 0.8rem; color: #ff6b8a; font-size: 0.26rem; padding: 0.12rem 0.24rem; width: 100%; }
.stats { display: flex; justify-content: space-around; padding: 0.32rem; text-align: center; }
.stats strong { display: block; font-size: 0.4rem; }
.stats span { color: rgba(255,255,255,.45); font-size: 0.26rem; }
.task-card { background: #1a1a1a; border-radius: 0.16rem; margin: 0 0.32rem 0.32rem; padding: 0.32rem; }
.task-card p { color: rgba(255,255,255,.55); font-size: 0.28rem; margin: 0.12rem 0 0.24rem; }
.task-card button { background: #ff2d55; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.28rem; padding: 0.12rem 0.32rem; }
.quick-apps { padding: 0 0.32rem 0.32rem; }
.quick-scroll { display: flex; gap: 0.24rem; overflow-x: auto; }
.quick-app { align-items: center; background: none; border: none; color: rgba(255,255,255,.75); display: flex; flex-direction: column; flex-shrink: 0; font-size: 0.26rem; gap: 0.12rem; }
.quick-app .icon { align-items: center; background: #2a2a2a; border-radius: 0.24rem; display: flex; height: 1rem; justify-content: center; width: 1rem; }
.services { padding: 0 0.32rem; }
.services h3 { font-size: 0.36rem; margin-bottom: 0.24rem; }
.service-grid { display: grid; gap: 0.16rem; grid-template-columns: repeat(3, 1fr); }
.service { background: #1a1a1a; border: none; border-radius: 0.12rem; color: rgba(255,255,255,.75); font-size: 0.28rem; padding: 0.24rem 0.16rem; }
.version { color: rgba(255,255,255,.25); font-size: 0.26rem; padding: 0.48rem; text-align: center; }
</style>
