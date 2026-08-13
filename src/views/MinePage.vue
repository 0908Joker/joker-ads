<template>
  <TabShell active="mine">
    <section class="profile">
      <img class="profile__bg" src="/mine/bg.png" alt="" />
      <div class="profile__top">
        <p class="id">ID: {{ user.id }} <span>⧉</span></p>
        <div class="profile__tools">⟳ 🎁 🔔 ⬆</div>
      </div>
      <div class="profile__row">
        <div class="avatar">小红书</div>
        <div class="info">
          <h2>{{ user.name }}</h2>
          <p class="bio">{{ user.bio }}</p>
        </div>
      </div>
      <button class="bind-btn">注册/绑定有礼 1日VIP 去绑定</button>
      <div class="stats">
        <div><strong>{{ stats.follow }}</strong><span>关注</span></div>
        <div><strong>{{ stats.like }}</strong><span>点赞</span></div>
        <div><strong>{{ stats.fav }}</strong><span>收藏</span></div>
      </div>
    </section>

    <div class="pay-row">
      <article class="pay-card pay-card--vip">
        <strong>vip会员中心</strong>
        <p>限时特惠权限等你开启</p>
        <button>立即开通</button>
      </article>
      <article class="pay-card pay-card--gold">
        <strong>钻石充值</strong>
        <p>充值越高赠送越多</p>
        <button>立即充值</button>
      </article>
    </div>

    <section class="task-card">
      <div>
        <strong>每日任务</strong>
        <p>完成签到可恢复断签并领取奖励</p>
      </div>
      <button @click="onSignin">立即前往</button>
    </section>

    <div class="feature-row">
      <button class="feature feature--green"><strong>身份卡</strong><span>权利象征</span></button>
      <button class="feature feature--yellow"><strong>AI创造中心</strong><span>女友相伴</span></button>
      <button class="feature feature--pink"><strong>分享邀请</strong><span>邀请好友得好礼</span></button>
    </div>

    <section class="quick-row">
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
      <h3>推荐应用 <span @click="$router.push('/appcenter')">更多</span></h3>
      <div class="quick-scroll">
        <button v-for="app in recommend" :key="'r-' + app.name" class="quick-app" @click="openApp(app)">
          <img v-if="app.icon" :src="app.icon" alt="" class="quick-app__img" />
          <div v-else class="quick-app__img quick-app__img--ph">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
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
import tabsFallback from '../data/tabs.json'
import config from '../data/config.json'
import { fetchUserInfo, fetchUserSignin, fetchActionStats } from '../api/users.js'
import { normalizeUser, normalizeStats } from '../api/normalize.js'
import { openAdSign } from '../api/ad.js'

const router = useRouter()
const user = ref({ ...tabsFallback.mine.user })
const stats = ref({ ...tabsFallback.mine.stats })
const version = 'v1.1.169'
const services = tabsFallback.mine.services

const names = ['免费看片', '上门约炮', '新葡京', '同城约炮', '波多涩漫', '免费看黄片', '海角社区', '浪浪山', 'JVID', 'oio禁漫']
const recNames = ['免费看片', '上门约炮', '同城约炮', '新葡京', '波多涩漫']
const myAds = config.apps.filter((a) => names.includes(a.name))
const row1 = computed(() => myAds.slice(0, 6).map((a) => ({ name: a.name, icon: a.icon, signUrl: a.signUrl, url: a.url })))
const row2 = computed(() => myAds.slice(6, 12).map((a) => ({ name: a.name, icon: a.icon, signUrl: a.signUrl, url: a.url })))
const recommend = computed(() =>
  recNames.map((n) => config.apps.find((a) => a.name === n)).filter(Boolean),
)

function openApp(app) {
  const target = app.signUrl || app.url
  if (target?.startsWith('http')) openAdSign(target)
}
function onService(name) {
  if (name === '我的视频') router.push('/videosPage')
  else if (name === '下载管理') router.push('/appcenter')
}
async function onSignin() {
  try { await fetchUserSignin() } catch {}
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
.profile {
  overflow: hidden;
  padding: 0.32rem 0.32rem 0.16rem;
  position: relative;
}
.profile__bg {
  inset: 0;
  object-fit: cover;
  object-position: top;
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.profile__top,
.profile__row,
.bind-btn,
.stats {
  position: relative;
  z-index: 1;
}
.profile__top { align-items: center; display: flex; justify-content: space-between; }
.id { color: rgba(255,255,255,.8); font-size: 0.26rem; }
.profile__tools { font-size: 0.32rem; letter-spacing: 0.12rem; }
.profile__row { align-items: center; display: flex; gap: 0.24rem; margin-top: 0.24rem; }
.avatar {
  align-items: center; background: #f81942; border-radius: 50%; display: flex; font-size: 0.22rem;
  height: 1.28rem; justify-content: center; width: 1.28rem;
}
.info h2 { font-size: 0.44rem; }
.bio { color: rgba(255,255,255,.7); font-size: 0.26rem; margin-top: 0.08rem; }
.bind-btn {
  background: #f81942; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.26rem;
  margin-top: 0.2rem; padding: 0.12rem 0.24rem; width: 100%;
}
.stats { display: flex; justify-content: space-around; padding: 0.28rem 0 0.08rem; text-align: center; }
.stats strong { display: block; font-size: 0.4rem; }
.stats span { color: rgba(255,255,255,.55); font-size: 0.26rem; }
.pay-row { display: flex; gap: 0.16rem; padding: 0.16rem 0.32rem; }
.pay-card { border-radius: 0.16rem; flex: 1; padding: 0.24rem; }
.pay-card--vip { background: linear-gradient(135deg, #d4a017, #8a6a10); color: #2a1a00; }
.pay-card--gold { background: #2a2a2a; }
.pay-card strong { display: block; font-size: 0.3rem; }
.pay-card p { font-size: 0.22rem; margin: 0.08rem 0 0.16rem; opacity: .8; }
.pay-card button { background: #f81942; border: none; border-radius: 0.8rem; color: #fff; font-size: 0.24rem; padding: 0.08rem 0.16rem; }
.task-card {
  align-items: center; background: #f81942; border-radius: 0.16rem; display: flex;
  justify-content: space-between; margin: 0 0.32rem 0.24rem; padding: 0.24rem;
}
.task-card p { font-size: 0.24rem; margin-top: 0.06rem; opacity: .9; }
.task-card button { background: #fff; border: none; border-radius: 0.8rem; color: #f81942; font-size: 0.26rem; padding: 0.1rem 0.2rem; }
.feature-row { display: flex; gap: 0.12rem; padding: 0 0.32rem 0.24rem; }
.feature { border: none; border-radius: 0.16rem; flex: 1; padding: 0.24rem 0.12rem; text-align: left; }
.feature strong { display: block; font-size: 0.28rem; }
.feature span { color: rgba(0,0,0,.55); font-size: 0.22rem; }
.feature--green { background: #b8e0c8; color: #123; }
.feature--yellow { background: #f3e2a8; color: #123; }
.feature--pink { background: #f5c0d0; color: #123; }
.quick-row { padding: 0 0.32rem 0.16rem; }
.quick-scroll { display: flex; gap: 0.2rem; overflow-x: auto; }
.quick-app { align-items: center; background: none; border: none; color: rgba(255,255,255,.75); display: flex; flex-direction: column; flex-shrink: 0; font-size: 0.24rem; gap: 0.1rem; }
.quick-app__img { border-radius: 0.2rem; height: 1.1rem; object-fit: cover; width: 1.1rem; }
.quick-app__img--ph { align-items: center; background: #2a2a2a; display: flex; font-size: 0.26rem; font-weight: 700; justify-content: center; }
.recommend { padding: 0.08rem 0.32rem 0.24rem; }
.recommend h3 { font-size: 0.34rem; margin-bottom: 0.12rem; }
.recommend span { color: rgba(255,255,255,.45); float: right; font-size: 0.28rem; font-weight: 400; }
.services { padding: 0 0.32rem; }
.services h3 { font-size: 0.36rem; margin-bottom: 0.2rem; }
.service-grid { display: grid; gap: 0.16rem; grid-template-columns: repeat(3, 1fr); }
.service { background: #1a1a1a; border: none; border-radius: 0.12rem; color: rgba(255,255,255,.75); font-size: 0.28rem; padding: 0.24rem 0.12rem; }
.version { color: rgba(255,255,255,.25); font-size: 0.26rem; padding: 0.48rem; text-align: center; }
</style>
