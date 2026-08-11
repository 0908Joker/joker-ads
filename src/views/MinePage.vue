<template>
  <TabShell active="mine">
    <section class="profile">
      <div class="avatar" />
      <div class="info">
        <p class="id">ID: {{ user.id }}</p>
        <h2>{{ user.name }}</h2>
        <p class="bio">{{ user.bio }}</p>
      </div>
      <button class="bind-btn">注册/绑定有礼 1日VIP 去绑定</button>
    </section>
    <div class="stats">
      <div><strong>{{ stats.follow }}</strong><span>关注</span></div>
      <div><strong>{{ stats.like }}</strong><span>点赞</span></div>
      <div><strong>{{ stats.fav }}</strong><span>收藏</span></div>
    </div>
    <section class="task-card">
      <strong>每日任务</strong>
      <p>完成签到可恢复断签并领取奖励</p>
      <button @click="onSignin">立即前往</button>
    </section>
    <section class="quick-row">
      <h3>快捷入口</h3>
      <div class="quick-scroll">
        <button v-for="app in row1" :key="app.name" class="quick-app" @click="openApp(app)">
          <img v-if="app.iconLocal || app.icon" :src="app.iconLocal || app.icon" alt="" class="quick-app__img" />
          <div v-else class="quick-app__img quick-app__img--ph">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
    </section>
    <section v-if="row2.length" class="quick-row">
      <div class="quick-scroll">
        <button v-for="app in row2" :key="app.name + '-2'" class="quick-app" @click="openApp(app)">
          <img v-if="app.iconLocal || app.icon" :src="app.iconLocal || app.icon" alt="" class="quick-app__img" />
          <div v-else class="quick-app__img quick-app__img--ph">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
    </section>
    <section class="recommend">
      <h3>推荐应用 <span>更多</span></h3>
      <p class="recommend__empty">暂无推荐应用</p>
      <button class="recommend__link" @click="$router.push('/appcenter')">前往应用中心</button>
    </section>
    <section class="services">
      <h3>更多服务</h3>
      <div class="service-grid">
        <button v-for="s in services" :key="s" class="service" @click="onService(s)">{{ s }}</button>
      </div>
    </section>
    <p class="version">{{ version }}</p>
  </TabShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import config from '../data/config.json'
import { fetchUserInfo, fetchUserSignin, fetchActionStats } from '../api/users.js'
import { normalizeUser, normalizeStats } from '../api/normalize.js'
import { openAdSign } from '../api/ad.js'

const router = useRouter()
const user = ref(normalizeUser(liveApi.userInfo, tabsFallback.mine.user))
const stats = ref(normalizeStats({}, tabsFallback.mine.stats))
const version = feeds.mine?.version || tabsFallback.mine.version
const services = tabsFallback.mine.services

const myAds = config.apps.filter((a) =>
  ['免费看片', '上门约炮', '新葡京', '同城约炮', '波多涩漫', '免费看黄片', '海角社区', '浪浪山', 'JVID'].includes(a.name),
)

const row1 = computed(() => {
  const live = feeds.mine?.quickApps?.filter((a) => a.name)
  if (live?.length >= 5) return live.slice(0, 6)
  return myAds.slice(0, 6).map((a) => ({ name: a.name, icon: a.icon, signUrl: a.signUrl, url: a.url }))
})

const row2 = computed(() => myAds.slice(6, 12).map((a) => ({ name: a.name, icon: a.icon, signUrl: a.signUrl, url: a.url })))

function openApp(app) {
  const target = app.signUrl || app.url
  if (target?.startsWith('http')) openAdSign(target)
}

function onService(name) {
  if (name === '我的视频') router.push('/videosPage')
  else if (name === '下载管理') router.push('/appcenter')
  else if (name === '客服中心') openAdSign(config.floatBanner?.signUrl || config.floatBanner?.url)
}

async function onSignin() {
  try {
    await fetchUserSignin()
  } catch {}
}

onMounted(async () => {
  try {
    const info = await fetchUserInfo()
    user.value = normalizeUser(info.data ?? info, tabsFallback.mine.user)
  } catch {}
  try {
    const s = await fetchActionStats()
    stats.value = normalizeStats(s.data ?? s, tabsFallback.mine.stats)
  } catch {}
})
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
.quick-row { padding: 0 0.32rem 0.24rem; }
.quick-row h3 { font-size: 0.34rem; margin-bottom: 0.16rem; }
.quick-scroll { display: flex; gap: 0.24rem; overflow-x: auto; }
.quick-app { align-items: center; background: none; border: none; color: rgba(255,255,255,.75); display: flex; flex-direction: column; flex-shrink: 0; font-size: 0.24rem; gap: 0.12rem; }
.quick-app__img { border-radius: 0.24rem; height: 1rem; object-fit: cover; width: 1rem; }
.quick-app__img--ph { align-items: center; background: #2a2a2a; display: flex; font-size: 0.28rem; font-weight: 700; justify-content: center; }
.recommend { padding: 0 0.32rem 0.32rem; }
.recommend h3 { font-size: 0.34rem; }
.recommend span { color: rgba(255,255,255,.45); float: right; font-size: 0.28rem; font-weight: 400; }
.recommend__empty { color: rgba(255,255,255,.45); font-size: 0.28rem; margin: 0.16rem 0; }
.recommend__link { background: none; border: 1px solid rgba(255,255,255,.2); border-radius: 0.8rem; color: rgba(255,255,255,.7); font-size: 0.28rem; padding: 0.12rem 0.32rem; }
.services { padding: 0 0.32rem; }
.services h3 { font-size: 0.36rem; margin-bottom: 0.24rem; }
.service-grid { display: grid; gap: 0.16rem; grid-template-columns: repeat(3, 1fr); }
.service { background: #1a1a1a; border: none; border-radius: 0.12rem; color: rgba(255,255,255,.75); font-size: 0.28rem; padding: 0.24rem 0.16rem; }
.version { color: rgba(255,255,255,.25); font-size: 0.26rem; padding: 0.48rem; text-align: center; }
</style>
