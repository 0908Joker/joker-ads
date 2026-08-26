<template>
  <SubPage title="分享邀请">
    <section class="invite">
      <p class="invite__label">我的邀请码</p>
      <strong class="invite__code">{{ account.inviteCode || '—' }}</strong>
      <button class="invite__copy" @click="copy(account.inviteCode, '邀请码')">复制邀请码</button>
      <p class="invite__count">已成功邀请 {{ account.inviteCount }} 人</p>
    </section>

    <section v-if="shareLink" class="link">
      <p class="link__label">专属邀请链接</p>
      <p class="link__url">{{ shareLink }}</p>
      <button class="link__copy" @click="copy(shareLink, '邀请链接')">复制链接</button>
    </section>

    <section class="rules">
      <h3>邀请规则</h3>
      <p>1. 复制链接或邀请码分享给好友，好友下载并注册后即算邀请成功。</p>
      <p>2. 邀请成功后，双方均可获得会员时长奖励。</p>
      <p>3. 好友需完成账号绑定，奖励才会到账。</p>
    </section>
  </SubPage>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import SubPage from '../components/SubPage.vue'
import { fetchUserInfo } from '../api/users.js'
import { normalizeAccount } from '../api/normalize.js'
import { copyText, showToast } from '../composables/useToast.js'

const account = ref(normalizeAccount(null))

const shareLink = computed(() => {
  const base = account.value.downloadUrl
  const code = account.value.inviteCode
  if (!base) return ''
  return code ? `${base}?inviteCode=${encodeURIComponent(code)}` : base
})

async function copy(value, label) {
  if (!value) {
    showToast(`${label}暂不可用`)
    return
  }
  showToast((await copyText(value)) ? `${label}已复制` : '复制失败，请手动选择')
}

onMounted(async () => {
  try {
    const info = await fetchUserInfo()
    account.value = normalizeAccount(info.data ?? info)
  } catch {
    showToast('获取邀请信息失败')
  }
})
</script>

<style scoped>
.invite {
  background: linear-gradient(135deg, #f81942, #8a1029);
  border-radius: 0.16rem;
  margin-bottom: 0.24rem;
  padding: 0.36rem 0.28rem;
  text-align: center;
}
.invite__label {
  font-size: 0.26rem;
  opacity: 0.85;
}
.invite__code {
  display: block;
  font-size: 0.62rem;
  letter-spacing: 0.04rem;
  margin: 0.12rem 0 0.2rem;
}
.invite__copy {
  background: #fff;
  border: none;
  border-radius: 0.8rem;
  color: #f81942;
  font-size: 0.28rem;
  font-weight: 600;
  margin-top: 0.16rem;
  padding: 0.14rem 0.4rem;
}
.invite__count {
  font-size: 0.24rem;
  margin-top: 0.16rem;
  opacity: 0.85;
}
.link {
  background: #1a1a1a;
  border-radius: 0.16rem;
  margin-bottom: 0.24rem;
  padding: 0.24rem;
}
.link__label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.24rem;
}
.link__url {
  font-size: 0.26rem;
  margin: 0.1rem 0 0.16rem;
  word-break: break-all;
}
.link__copy {
  background: #2a2a2a;
  border: none;
  border-radius: 0.8rem;
  color: #fff;
  font-size: 0.28rem;
  padding: 0.14rem 0.32rem;
}
.rules h3 {
  font-size: 0.32rem;
  margin-bottom: 0.12rem;
}
.rules p {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.26rem;
  line-height: 1.8;
}
</style>
