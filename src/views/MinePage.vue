<template>
  <TabShell active="mine">
    <section class="profile">
      <div class="profile__glow" aria-hidden="true" />
      <div class="profile__top">
        <p class="id">
          ID {{ user.id }}
          <button class="id__copy" aria-label="复制ID" @click="copyId">复制</button>
        </p>
        <div class="profile__tools">
          <button aria-label="刷新" @click="refresh">刷新</button>
          <button aria-label="福利中心" @click="router.push('/myBenefits')">福利</button>
          <button aria-label="消息" @click="router.push('/message')">消息</button>
          <button aria-label="分享邀请" @click="router.push('/my/shareApp')">邀请</button>
        </div>
      </div>
      <div class="profile__row">
        <div class="avatar">{{ avatarText }}</div>
        <div class="info">
          <h2>{{ user.name }}</h2>
          <p class="bio">{{ user.bio }}</p>
        </div>
      </div>
      <button class="bind-btn" @click="onBind">
        <span>注册 / 绑定有礼</span>
        <em>送 1 日 VIP</em>
      </button>
      <div class="stats">
        <div><strong>{{ stats.follow }}</strong><span>关注</span></div>
        <div><strong>{{ stats.like }}</strong><span>点赞</span></div>
        <div><strong>{{ stats.fav }}</strong><span>收藏</span></div>
      </div>
    </section>

    <div class="pay-row">
      <article class="pay-card pay-card--vip">
        <span class="pay-card__eyebrow">MEMBER</span>
        <strong>VIP 会员中心</strong>
        <p>限时特惠权限等你开启</p>
        <button @click="goRecharge('vip')">立即开通</button>
      </article>
      <article class="pay-card pay-card--gold">
        <span class="pay-card__eyebrow">WALLET</span>
        <strong>钻石充值</strong>
        <p>充值越高赠送越多</p>
        <button @click="goRecharge('gold')">立即充值</button>
      </article>
    </div>

    <section class="task-card" @click="router.push('/activityPage/dailyCheckIn')">
      <div>
        <strong>每日任务</strong>
        <p>完成签到可恢复断签并领取奖励</p>
      </div>
      <span class="task-card__go">前往</span>
    </section>

    <div class="feature-row">
      <button class="feature" @click="router.push('/myBenefits')">
        <strong>身份卡</strong><span>权利象征</span>
      </button>
      <button class="feature" @click="showToast('AI创造中心暂未开放')">
        <strong>AI 创造</strong><span>女友相伴</span>
      </button>
      <button class="feature" @click="router.push('/my/shareApp')">
        <strong>分享邀请</strong><span>好友得好礼</span>
      </button>
    </div>

    <section class="panel">
      <header class="panel__head">
        <h3>热门入口</h3>
      </header>
      <div class="quick-grid quick-grid--6">
        <button v-for="(app, i) in row1" :key="'q1-' + app.name + i" class="quick-app" @click="openApp(app)">
          <img v-if="app.iconLocal || app.icon" :src="app.iconLocal || app.icon" alt="" class="quick-app__img" />
          <div v-else class="quick-app__img quick-app__img--ph">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
      <div v-if="row2.length" class="quick-grid quick-grid--6 quick-grid--second">
        <button v-for="(app, i) in row2" :key="'q2-' + app.name + i" class="quick-app" @click="openApp(app)">
          <img v-if="app.iconLocal || app.icon" :src="app.iconLocal || app.icon" alt="" class="quick-app__img" />
          <div v-else class="quick-app__img quick-app__img--ph">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h3>推荐应用</h3>
        <button class="panel__more" @click="$router.push('/appcenter')">更多</button>
      </header>
      <div class="quick-grid" :style="{ gridTemplateColumns: `repeat(${recommend.length || 5}, minmax(0, 1fr))` }">
        <button v-for="(app, i) in recommend" :key="'r-' + app.name + i" class="quick-app" @click="openApp(app)">
          <img v-if="app.icon" :src="app.icon" alt="" class="quick-app__img" />
          <div v-else class="quick-app__img quick-app__img--ph">{{ app.name.slice(0, 2) }}</div>
          <span>{{ app.name }}</span>
        </button>
      </div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h3>更多服务</h3>
      </header>
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
import { useSiteConfig } from '../composables/useSiteConfig.js'
import tabsFallback from '../data/tabs.json'
import { fetchUserInfo } from '../api/users.js'
import { normalizeUser, normalizeStats } from '../api/normalize.js'
import { openAd } from '../api/ad.js'
import { copyText, showToast } from '../composables/useToast.js'

const siteConfig = useSiteConfig()
const config = computed(() => siteConfig.config)
const router = useRouter()
const user = ref({ ...tabsFallback.mine.user })
const stats = ref({ ...tabsFallback.mine.stats })
const version = tabsFallback.mine.version || 'v1.1.169'
const services = tabsFallback.mine.services

const ROW1_NAMES = ['oio禁漫', '免费看黄片', '新葡京', '海角社区', '同城约炮', '新葡京']
const ROW2_NAMES = ['免费看黄片', '免费看片', '同城约炮', '免费看片', '免费看片', '免费看黄片']
const REC_NAMES = ['免费看片', '上门约炮', '同城约炮', '新葡京', '波多涩漫']

function resolveApp(name) {
  const hit = (config.value.apps || []).find((a) => a.name === name)
  if (hit) return { name: hit.name, icon: hit.icon, signUrl: hit.signUrl, url: hit.url }
  const fromTabs = (tabsFallback.mine.quickApps || []).find((a) => a.name === name)
  if (fromTabs) return { name: fromTabs.name, icon: fromTabs.icon, signUrl: fromTabs.signUrl, url: fromTabs.url }
  return { name, icon: '', signUrl: '', url: '' }
}

const row1 = computed(() => ROW1_NAMES.map(resolveApp))
const row2 = computed(() => ROW2_NAMES.map(resolveApp))
const recommend = computed(() => REC_NAMES.map(resolveApp))

const avatarText = computed(() => {
  const n = String(user.value.name || '得污').trim()
  return n.slice(0, 1) || '污'
})

function openApp(app) {
  openAd(app)
}
function goRecharge(type) {
  router.push(type === 'gold' ? '/recharge?type=gold' : '/recharge?type=vip')
}
function onService(name) {
  if (name === '我的视频') router.push('/videosPage')
  else if (name === '下载管理') router.push('/appcenter')
  else if (name === '订单记录' || name === '充值记录' || name === '购买记录') router.push('/recharge')
  else if (name === '客服中心' || name === '消息' || name === '在线客服' || name === '联系客服') router.push('/message')
  else if (name === '分享邀请' || name === '邀请好友' || name === '分享推广') router.push('/my/shareApp')
  else if (name === '我的福利') router.push('/myBenefits')
  else if (name === '商务合作') {
    window.open('https://t.me/Ailen99999', '_blank', 'noopener,noreferrer')
  }
  else showToast(`${name}暂未开放`)
}

async function copyId() {
  const id = String(user.value.id || '')
  if (!id) {
    showToast('ID 暂不可用')
    return
  }
  showToast((await copyText(id)) ? 'ID 已复制' : '复制失败，请手动选择')
}

function onBind() {
  showToast('绑定功能需在 App 内完成')
}

async function loadUser() {
  const info = await fetchUserInfo()
  const data = info.data ?? info
  user.value = normalizeUser(data, tabsFallback.mine.user)
  stats.value = normalizeStats(data, tabsFallback.mine.stats)
}

async function refresh() {
  try {
    await loadUser()
    showToast('已刷新')
  } catch {
    showToast('刷新失败，请稍后再试')
  }
}

onMounted(() => {
  loadUser().catch(() => {})
})
</script>

<style scoped>
.profile {
  background:
    radial-gradient(ellipse 80% 70% at 12% 0%, rgba(0, 200, 232, 0.1), transparent 55%),
    linear-gradient(180deg, #0c1016 0%, var(--dw-bg) 100%);
  overflow: hidden;
  padding: 0.32rem var(--dw-pad-x) 0.24rem;
  position: relative;
}
.profile__glow {
  background: linear-gradient(90deg, transparent, var(--dw-cyan), transparent);
  bottom: 0;
  height: 1px;
  left: 12%;
  opacity: 0.35;
  pointer-events: none;
  position: absolute;
  right: 12%;
}
.profile__top {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 0.16rem;
}
.id {
  align-items: center;
  color: var(--dw-muted);
  display: flex;
  font-size: 0.24rem;
  gap: 0.1rem;
  letter-spacing: 0.02em;
}
.id__copy {
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: 999px;
  color: var(--dw-muted);
  font-size: 0.22rem;
  padding: 0.05rem 0.14rem;
}
.profile__tools {
  display: flex;
  gap: 0.08rem;
}
.profile__tools button {
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: 999px;
  color: var(--dw-muted);
  font-size: 0.22rem;
  padding: 0.08rem 0.14rem;
}
.profile__tools button:active,
.id__copy:active {
  opacity: 0.7;
}
.profile__row {
  align-items: center;
  display: flex;
  gap: 0.24rem;
  margin-top: 0.28rem;
}
.avatar {
  align-items: center;
  background: var(--dw-cyan);
  border-radius: 50%;
  color: var(--dw-ink-on-cyan);
  display: flex;
  font-size: 0.48rem;
  font-weight: 700;
  height: 1.28rem;
  justify-content: center;
  width: 1.28rem;
}
.info h2 {
  font-size: 0.42rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.bio {
  color: var(--dw-muted);
  font-size: 0.26rem;
  margin-top: 0.08rem;
}
.bind-btn {
  align-items: center;
  background: var(--dw-surface);
  border: 1px solid var(--dw-line);
  border-radius: 999px;
  color: var(--dw-text);
  display: flex;
  font-size: 0.28rem;
  font-weight: 600;
  justify-content: space-between;
  margin-top: 0.24rem;
  padding: 0.18rem 0.28rem;
  width: 100%;
}
.bind-btn em {
  color: var(--dw-cyan);
  font-style: normal;
  font-size: 0.24rem;
  font-weight: 700;
}
.stats {
  display: flex;
  justify-content: space-around;
  padding: 0.32rem 0 0.08rem;
  text-align: center;
}
.stats strong {
  display: block;
  font-size: 0.4rem;
  font-weight: 700;
}
.stats span {
  color: var(--dw-muted);
  font-size: 0.24rem;
}
.pay-row {
  display: flex;
  gap: 0.14rem;
  padding: 0.24rem var(--dw-pad-x) 0;
}
.pay-card {
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: var(--dw-radius);
  flex: 1;
  padding: 0.24rem;
}
.pay-card--vip {
  background:
    linear-gradient(160deg, rgba(0, 200, 232, 0.1), transparent 55%),
    var(--dw-surface);
}
.pay-card__eyebrow {
  color: var(--dw-cyan);
  display: block;
  font-size: 0.18rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin-bottom: 0.1rem;
}
.pay-card strong {
  display: block;
  font-size: 0.3rem;
}
.pay-card p {
  color: var(--dw-muted);
  font-size: 0.22rem;
  margin: 0.1rem 0 0.18rem;
}
.pay-card button {
  background: var(--dw-cyan);
  border: none;
  border-radius: 999px;
  color: var(--dw-ink-on-cyan);
  font-size: 0.24rem;
  font-weight: 700;
  padding: 0.1rem 0.18rem;
}
.task-card {
  align-items: center;
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: var(--dw-radius);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  margin: 0.2rem var(--dw-pad-x) 0;
  padding: 0.24rem 0.28rem;
}
.task-card strong {
  font-size: 0.32rem;
}
.task-card p {
  color: var(--dw-muted);
  font-size: 0.24rem;
  margin-top: 0.06rem;
}
.task-card__go {
  background: var(--dw-cyan);
  border-radius: 999px;
  color: var(--dw-ink-on-cyan);
  font-size: 0.26rem;
  font-weight: 700;
  padding: 0.1rem 0.22rem;
}
.feature-row {
  display: flex;
  gap: 0.12rem;
  padding: 0.2rem var(--dw-pad-x) 0;
}
.feature {
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: var(--dw-radius);
  color: var(--dw-text);
  flex: 1;
  padding: 0.22rem 0.14rem;
  text-align: left;
}
.feature strong {
  display: block;
  font-size: 0.26rem;
}
.feature span {
  color: var(--dw-muted);
  display: block;
  font-size: 0.2rem;
  margin-top: 0.08rem;
}
.panel {
  padding: 0.36rem var(--dw-pad-x) 0.04rem;
}
.panel__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.18rem;
}
.panel__head h3 {
  align-items: center;
  display: flex;
  font-size: 0.32rem;
  font-weight: 600;
  gap: 0.12rem;
  letter-spacing: 0.04em;
}
.panel__head h3::before {
  background: var(--dw-cyan);
  border-radius: 2px;
  content: '';
  height: 0.28rem;
  width: 0.06rem;
}
.panel__more {
  background: none;
  border: none;
  color: var(--dw-cyan);
  font-size: 0.26rem;
}
.quick-grid {
  display: grid;
  gap: 0.18rem 0.1rem;
  width: 100%;
}
.quick-grid--6 {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
.quick-grid--second {
  margin-top: 0.18rem;
}
.quick-app {
  align-items: center;
  background: none;
  border: none;
  color: var(--dw-muted);
  display: flex;
  flex-direction: column;
  font-size: 0.22rem;
  gap: 0.1rem;
  min-width: 0;
  width: 100%;
}
.quick-app__img {
  aspect-ratio: 1;
  border: 1px solid var(--dw-hair);
  border-radius: 0.24rem;
  height: auto;
  margin: 0 auto;
  max-width: 1.16rem;
  object-fit: cover;
  width: 100%;
}
.quick-app__img--ph {
  align-items: center;
  background: var(--dw-surface-2);
  color: var(--dw-text);
  display: flex;
  font-size: 0.26rem;
  font-weight: 700;
  justify-content: center;
}
.quick-app span {
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
.service-grid {
  display: grid;
  gap: 0.12rem;
  grid-template-columns: repeat(3, 1fr);
}
.service {
  background: var(--dw-surface);
  border: 1px solid var(--dw-hair);
  border-radius: var(--dw-radius-sm);
  color: var(--dw-muted);
  font-size: 0.26rem;
  padding: 0.28rem 0.08rem;
}
.service:active {
  border-color: var(--dw-line);
  color: var(--dw-cyan-soft);
}
.version {
  color: var(--dw-faint);
  font-size: 0.22rem;
  letter-spacing: 0.06em;
  padding: 0.56rem var(--dw-pad-x) 0.9rem;
  text-align: center;
}
</style>
