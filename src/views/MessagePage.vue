<template>
  <SubPage title="消息">
    <p class="empty">暂无新消息</p>
    <button class="service" @click="openService">联系在线客服</button>
  </SubPage>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import SubPage from '../components/SubPage.vue'
import { fetchUserInfo } from '../api/users.js'
import { normalizeAccount } from '../api/normalize.js'
import { showToast } from '../composables/useToast.js'

const account = ref(normalizeAccount(null))

function openService() {
  const url = account.value.customerUrl
  if (!url) {
    showToast('客服地址暂未配置')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

onMounted(async () => {
  try {
    const info = await fetchUserInfo()
    account.value = normalizeAccount(info.data ?? info)
  } catch {}
})
</script>

<style scoped>
.empty {
  color: var(--dw-muted);
  font-size: 0.28rem;
  padding: 1.6rem 0;
  text-align: center;
}
.service {
  background: var(--dw-cyan);
  border: none;
  border-radius: 0.8rem;
  color: #061018;
  font-size: 0.3rem;
  font-weight: 700;
  padding: 0.24rem;
  width: 100%;
}
</style>
