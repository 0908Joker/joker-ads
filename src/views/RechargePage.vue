<template>
  <div class="recharge">
    <header class="recharge__head">
      <button class="recharge__back" @click="router.back()">‹</button>
      <h1>{{ pageTitle }}</h1>
    </header>

    <nav class="recharge__tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="recharge__tab"
        :class="{ 'is-active': activeTab === t.id }"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
    </nav>

    <p v-if="loading" class="recharge__hint">加载套餐中…</p>
    <p v-else-if="error" class="recharge__hint">{{ error }}</p>

    <section class="pkg-grid">
      <button
        v-for="(pkg, i) in packages"
        :key="pkg.id || i"
        class="pkg"
        :class="{ 'is-active': selected === i }"
        @click="selected = i"
      >
        <strong>{{ pkg.name }}</strong>
        <span class="pkg__price">¥{{ pkg.price }}</span>
        <span v-if="pkg.tip" class="pkg__tip">{{ pkg.tip }}</span>
      </button>
    </section>

    <section v-if="payTypes.length" class="pay-types">
      <h3>支付方式</h3>
      <button
        v-for="(p, i) in payTypes"
        :key="p.payType || i"
        class="pay-type"
        :class="{ 'is-active': payIndex === i }"
        @click="payIndex = i"
      >{{ p.name || p.payType }}</button>
    </section>

    <button class="recharge__submit" :disabled="submitting || !packages.length" @click="submit">
      {{ submitting ? '提交中…' : '立即支付' }}
    </button>
    <p class="recharge__note">支付由第三方通道处理，请勿在公共环境输入敏感信息。</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchVipCommodity,
  fetchGoldCommodity,
  fetchPayTypes,
  createVipOrder,
  createGoldOrder,
} from '../api/recharge.js'

const FALLBACK_VIP = [
  { id: 'vip-7', name: '7天VIP', price: 30, tip: '限时特惠', vipDays: 7, vipType: 'normal' },
  { id: 'vip-30', name: '30天VIP', price: 88, tip: '最受欢迎', vipDays: 30, vipType: 'normal' },
  { id: 'vip-90', name: '90天VIP', price: 198, tip: '超值', vipDays: 90, vipType: 'normal' },
]

const FALLBACK_GOLD = [
  { id: 'gold-50', name: '50钻石', price: 50, tip: '赠送5', goodsType: 4 },
  { id: 'gold-100', name: '100钻石', price: 100, tip: '赠送15', goodsType: 4 },
  { id: 'gold-300', name: '300钻石', price: 300, tip: '赠送60', goodsType: 4 },
]

const route = useRoute()
const router = useRouter()
const tabs = [
  { id: 'vip', label: 'VIP会员' },
  { id: 'gold', label: '钻石充值' },
]
const activeTab = ref(route.query.type === 'gold' || route.query.type === 'diamond' ? 'gold' : 'vip')
const packages = ref([])
const payTypes = ref([])
const selected = ref(0)
const payIndex = ref(0)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const pageTitle = computed(() => (activeTab.value === 'gold' ? '钻石充值' : 'VIP会员中心'))

function normalizePackages(data, kind) {
  const list = data?.commodityList || data?.goodsList || data?.list || data?.commodities || []
  if (!Array.isArray(list) || !list.length) return kind === 'gold' ? FALLBACK_GOLD : FALLBACK_VIP
  return list.slice(0, 8).map((row, i) => ({
    id: row.id || row.goodsId || `${kind}-${i}`,
    name: row.name || row.goodsName || row.title || '套餐',
    price: row.price ?? row.amount ?? row.payPrice ?? 0,
    tip: row.desc || row.remark || '',
    vipDays: row.vipEffectiveTime ?? row.vipDays,
    vipType: row.vipType || 'normal',
    goodsType: row.goodsType ?? 4,
    raw: row,
  }))
}

function normalizePayTypes(data) {
  const list = data?.payTypes || data?.payTypeList || data?.list || []
  return Array.isArray(list) ? list.slice(0, 6) : []
}

async function loadPackages() {
  loading.value = true
  error.value = ''
  selected.value = 0
  try {
    const raw =
      activeTab.value === 'gold' ? await fetchGoldCommodity() : await fetchVipCommodity()
    packages.value = normalizePackages(raw.data ?? raw, activeTab.value)
  } catch {
    packages.value = activeTab.value === 'gold' ? FALLBACK_GOLD : FALLBACK_VIP
    error.value = '套餐加载失败，已显示默认档位'
  } finally {
    loading.value = false
  }
}

async function loadPayTypes() {
  try {
    const raw = await fetchPayTypes()
    payTypes.value = normalizePayTypes(raw.data ?? raw)
  } catch {
    payTypes.value = [{ name: '支付宝', payType: 'alipay' }, { name: '微信', payType: 'wechat' }]
  }
}

async function submit() {
  const pkg = packages.value[selected.value]
  if (!pkg) return
  const pay = payTypes.value[payIndex.value]
  submitting.value = true
  try {
    const body =
      activeTab.value === 'gold'
        ? {
            goodsType: pkg.goodsType || 4,
            goodsName: pkg.name,
            payType: pay?.payType || pay?.name || 'alipay',
          }
        : {
            goodsType: 2,
            goodsName: pkg.name,
            vipDays: pkg.vipDays,
            vipType: pkg.vipType || 'normal',
            payType: pay?.payType || pay?.name || 'alipay',
          }
    const res =
      activeTab.value === 'gold' ? await createGoldOrder(body) : await createVipOrder(body)
    const data = res.data ?? res
    const url = data?.url || data?.payUrl || data?.h5Url
    if (url) {
      window.location.href = url
      return
    }
    error.value = res.message || data?.message || '订单已创建，请稍后在记录中查看'
  } catch (e) {
    error.value = e?.message || '支付通道暂不可用，请稍后重试'
  } finally {
    submitting.value = false
  }
}

watch(activeTab, () => loadPackages())
onMounted(async () => {
  await Promise.all([loadPackages(), loadPayTypes()])
})
</script>

<style scoped>
.recharge {
  background: #111;
  color: #fff;
  min-height: 100vh;
  padding: 0 0.32rem 0.8rem;
}
.recharge__head {
  align-items: center;
  display: flex;
  gap: 0.16rem;
  padding: 0.24rem 0 0.32rem;
}
.recharge__back {
  background: none;
  border: none;
  color: #fff;
  font-size: 0.56rem;
  line-height: 1;
  padding: 0 0.12rem;
}
.recharge__head h1 {
  font-size: 0.4rem;
}
.recharge__tabs {
  display: flex;
  gap: 0.16rem;
  margin-bottom: 0.24rem;
}
.recharge__tab {
  background: #2a2a2a;
  border: none;
  border-radius: 0.8rem;
  color: rgba(255, 255, 255, 0.65);
  flex: 1;
  font-size: 0.3rem;
  padding: 0.16rem;
}
.recharge__tab.is-active {
  background: #f81942;
  color: #fff;
  font-weight: 600;
}
.recharge__hint {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.26rem;
  margin-bottom: 0.16rem;
}
.pkg-grid {
  display: grid;
  gap: 0.16rem;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 0.32rem;
}
.pkg {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.16rem;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  padding: 0.24rem 0.16rem;
  text-align: center;
}
.pkg.is-active {
  border-color: #f81942;
  box-shadow: 0 0 0 1px #f81942 inset;
}
.pkg strong {
  font-size: 0.28rem;
}
.pkg__price {
  color: #ffd24a;
  font-size: 0.34rem;
  font-weight: 700;
}
.pkg__tip {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.22rem;
}
.pay-types h3 {
  font-size: 0.32rem;
  margin-bottom: 0.12rem;
}
.pay-types {
  margin-bottom: 0.32rem;
}
.pay-type {
  background: #2a2a2a;
  border: 1px solid transparent;
  border-radius: 0.12rem;
  color: #fff;
  font-size: 0.28rem;
  margin: 0 0.12rem 0.12rem 0;
  padding: 0.14rem 0.24rem;
}
.pay-type.is-active {
  border-color: #f81942;
  color: #f81942;
}
.recharge__submit {
  background: #f81942;
  border: none;
  border-radius: 0.8rem;
  color: #fff;
  font-size: 0.34rem;
  font-weight: 600;
  padding: 0.24rem;
  width: 100%;
}
.recharge__submit:disabled {
  opacity: 0.45;
}
.recharge__note {
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.22rem;
  margin-top: 0.16rem;
  text-align: center;
}
</style>
