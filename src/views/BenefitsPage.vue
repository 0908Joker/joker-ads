<template>
  <SubPage title="福利中心">
    <section class="wallet">
      <div class="wallet__vip">
        <div>
          <strong>{{ account.vipName }}</strong>
          <p v-if="account.vipUntil">有效期至 {{ account.vipUntil }}</p>
          <p v-else>开通会员解锁全站权益</p>
        </div>
        <button @click="router.push('/recharge?type=vip')">
          {{ account.isVip ? '续费' : '开通' }}
        </button>
      </div>
      <div class="wallet__grid">
        <div><strong>{{ account.gold }}</strong><span>钻石</span></div>
        <div><strong>{{ account.points }}</strong><span>积分</span></div>
        <div><strong>{{ account.watchTickets }}</strong><span>观影券</span></div>
        <div><strong>{{ account.downloadTickets }}</strong><span>下载券</span></div>
      </div>
    </section>

    <h3 class="sec-title">活动专区</h3>
    <p v-if="loading" class="hint">加载中…</p>
    <p v-else-if="!welfare.length" class="hint">暂无进行中的活动</p>
    <div class="welfare-grid">
      <button v-for="w in welfare" :key="w.id" class="welfare" @click="openWelfare(w)">
        <CebImg class="welfare__img" :path="w.imgUrl" />
        <span>{{ w.name }}</span>
      </button>
    </div>
  </SubPage>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SubPage from '../components/SubPage.vue'
import CebImg from '../components/CebImg.vue'
import { fetchUserInfo } from '../api/users.js'
import { fetchWelfareConfig } from '../api/activity.js'
import { normalizeAccount } from '../api/normalize.js'
import { showToast } from '../composables/useToast.js'

const router = useRouter()
const account = ref(normalizeAccount(null))
const welfare = ref([])
const loading = ref(true)

function openWelfare(w) {
  const url = w?.url || ''
  if (/^https?:/i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  if (url.startsWith('/')) {
    router.push(url)
    return
  }
  showToast(`${w.name} 暂未开放`)
}

onMounted(async () => {
  try {
    const info = await fetchUserInfo()
    account.value = normalizeAccount(info.data ?? info)
  } catch {}
  try {
    welfare.value = await fetchWelfareConfig()
  } catch {
    welfare.value = []
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.wallet {
  background: #1a1a1a;
  border-radius: 0.16rem;
  margin-bottom: 0.32rem;
  padding: 0.28rem;
}
.wallet__vip {
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  padding-bottom: 0.24rem;
}
.wallet__vip strong {
  color: #ffd24a;
  font-size: 0.34rem;
}
.wallet__vip p {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.24rem;
  margin-top: 0.06rem;
}
.wallet__vip button {
  background: #f81942;
  border: none;
  border-radius: 0.8rem;
  color: #fff;
  font-size: 0.28rem;
  padding: 0.12rem 0.32rem;
}
.wallet__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding-top: 0.24rem;
  text-align: center;
}
.wallet__grid strong {
  display: block;
  font-size: 0.36rem;
}
.wallet__grid span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.24rem;
}
.sec-title {
  font-size: 0.34rem;
  margin-bottom: 0.16rem;
}
.hint {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.26rem;
  padding: 0.24rem 0;
}
.welfare-grid {
  display: grid;
  gap: 0.16rem;
  grid-template-columns: repeat(2, 1fr);
}
.welfare {
  background: #1a1a1a;
  border: none;
  border-radius: 0.16rem;
  color: #fff;
  overflow: hidden;
  padding: 0;
  text-align: left;
}
.welfare :deep(.welfare__img) {
  aspect-ratio: 16 / 9;
  display: block;
  object-fit: cover;
  width: 100%;
}
.welfare span {
  display: block;
  font-size: 0.28rem;
  padding: 0.16rem;
}
</style>
