<template>
  <Teleport to="body">
    <div v-if="open" class="card-mask" @click="close">
      <div class="card" ref="cardEl" @click.stop>
        <div class="card__shine" aria-hidden="true" />
        <header class="card__head">
          <img src="/brand/logo.png" alt="得污" width="48" height="48" />
          <div>
            <strong>得污身份卡</strong>
            <span>得污 · 成人版</span>
          </div>
        </header>
        <ul class="card__rows">
          <li>
            <em>客户ID</em>
            <b>{{ customer.customerId || '—' }}</b>
            <button type="button" @click="copy(customer.customerId, '客户ID')">复制</button>
          </li>
          <li>
            <em>身份卡号</em>
            <b>{{ customer.cardNo || '—' }}</b>
            <button type="button" @click="copy(customer.cardNo, '身份卡号')">复制</button>
          </li>
          <li>
            <em>邀请码</em>
            <b>{{ customer.inviteCode || '—' }}</b>
            <button type="button" @click="copy(customer.inviteCode, '邀请码')">复制</button>
          </li>
        </ul>
        <div class="card__qr">
          <img v-if="qr" :src="qr" alt="得污邀请二维码" />
          <p v-else>二维码生成中…</p>
        </div>
        <p v-if="customer.error" class="card__err">{{ customer.error }}</p>
        <p class="card__url">{{ inviteUrl }}</p>
        <button type="button" class="card__save" @click="save">截图保存</button>
      </div>
      <button type="button" class="card-close" @click="close">关闭</button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { claimCustomer, customerState, dewuInviteUrl } from '../composables/useCustomer.js'
import { qrDataUrl } from '../lib/qr.js'
import { copyText, showToast } from '../composables/useToast.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const customer = customerState
const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
const qr = ref('')
const cardEl = ref(null)
const inviteUrl = computed(() => dewuInviteUrl(customer.inviteCode))

watch(
  () => [open.value, inviteUrl.value],
  async ([shown, url]) => {
    if (!shown) return
    if (!customer.customerId) {
      await claimCustomer()
    }
    if (!url) return
    try {
      qr.value = await qrDataUrl(dewuInviteUrl(customer.inviteCode), 280)
    } catch {
      qr.value = ''
    }
  },
)

function close() {
  open.value = false
}

async function copy(value, label) {
  if (!value) {
    showToast(`${label}暂不可用`)
    return
  }
  showToast((await copyText(value)) ? `${label}已复制` : '复制失败')
}

async function save() {
  const w = 720
  const h = 1080
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#090b0e'
  ctx.fillRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#11151b')
  g.addColorStop(1, '#050607')
  ctx.fillStyle = g
  ctx.fillRect(36, 36, w - 72, h - 72)
  ctx.strokeStyle = 'rgba(0,200,232,0.45)'
  ctx.lineWidth = 3
  ctx.strokeRect(36, 36, w - 72, h - 72)
  ctx.fillStyle = '#00c8e8'
  ctx.font = '700 28px sans-serif'
  ctx.fillText('得污 · 成人版', 72, 110)
  ctx.fillStyle = '#eef2f6'
  ctx.font = '700 44px sans-serif'
  ctx.fillText('得污身份卡', 72, 170)
  const lines = [
    ['客户ID', customer.customerId],
    ['身份卡号', customer.cardNo],
    ['邀请码', customer.inviteCode],
  ]
  ctx.font = '22px sans-serif'
  lines.forEach((row, i) => {
    ctx.fillStyle = 'rgba(238,242,246,0.5)'
    ctx.fillText(row[0], 72, 250 + i * 70)
    ctx.fillStyle = '#eef2f6'
    ctx.font = '700 26px sans-serif'
    ctx.fillText(String(row[1] || '—'), 72, 280 + i * 70)
    ctx.font = '22px sans-serif'
  })
  if (qr.value) {
    const img = new Image()
    img.src = qr.value
    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })
    ctx.fillStyle = '#fff'
    ctx.fillRect(210, 500, 300, 300)
    ctx.drawImage(img, 222, 512, 276, 276)
  }
  ctx.fillStyle = 'rgba(238,242,246,0.55)'
  ctx.font = '16px sans-serif'
  const url = inviteUrl.value
  ctx.fillText(url.slice(0, 42), 72, 860)
  if (url.length > 42) ctx.fillText(url.slice(42), 72, 886)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `${customer.cardNo || 'dewu-card'}.png`
  a.click()
  showToast('已保存，手机可长按相册')
}
</script>

<style scoped>
.card-mask {
  align-items: center;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 80;
}
.card {
  background: linear-gradient(165deg, #151b22 0%, #090b0e 70%);
  border: 1px solid var(--dw-line);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
  max-width: 360px;
  overflow: hidden;
  padding: 22px 22px 20px;
  position: relative;
  width: calc(100vw - 40px);
}
.card__shine {
  background: radial-gradient(circle at 20% 0%, rgba(0, 200, 232, 0.18), transparent 50%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}
.card__head {
  align-items: center;
  display: flex;
  gap: 12px;
  position: relative;
}
.card__head img {
  border-radius: 12px;
  height: 48px;
  width: 48px;
}
.card__head strong {
  display: block;
  font-size: 20px;
}
.card__head span {
  color: var(--dw-cyan);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}
.card__rows {
  list-style: none;
  margin: 18px 0 14px;
  position: relative;
}
.card__rows li {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: 64px 1fr auto;
  padding: 8px 0;
}
.card__rows em {
  color: var(--dw-muted);
  font-size: 12px;
  font-style: normal;
}
.card__rows b {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__rows button {
  background: none;
  border: none;
  color: var(--dw-cyan);
  font-size: 12px;
}
.card__qr {
  background: #fff;
  border-radius: 16px;
  margin: 0 auto;
  padding: 10px;
  width: 188px;
}
.card__qr img {
  display: block;
  width: 100%;
}
.card__err {
  color: #ff8a8a;
  font-size: 12px;
  margin: 8px 0 0;
  text-align: center;
}
.card__qr p,
.card__url {
  color: var(--dw-faint);
  font-size: 11px;
  margin-top: 10px;
  text-align: center;
  word-break: break-all;
}
.card__save {
  background: var(--dw-cyan);
  border: none;
  border-radius: 999px;
  color: var(--dw-ink-on-cyan);
  display: block;
  font-weight: 700;
  margin: 16px auto 0;
  padding: 10px 28px;
  width: 80%;
}
.card-close {
  background: none;
  border: none;
  color: #fff;
  margin-top: 16px;
}
</style>
