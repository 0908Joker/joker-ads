<template>
  <div v-if="visible" class="float-banner">
    <div class="float-banner__icon">PG</div>
    <div class="float-banner__text">
      <strong>{{ title }}</strong>
      <span>{{ subtitle }}</span>
    </div>
    <button class="float-banner__btn" @click="open">{{ btn }}</button>
    <button class="float-banner__close" @click="visible = false">×</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { openAd } from '../api/ad.js'

const props = defineProps({
  title: { type: String, default: 'PG电子大放水' },
  subtitle: { type: String, default: '投注爆千万' },
  url: { type: String, default: '' },
  signUrl: { type: String, default: '' },
  btn: { type: String, default: '下载' },
})

const visible = ref(true)

function open() {
  openAd({ url: props.url, signUrl: props.signUrl })
}
</script>

<style scoped>
.float-banner {
  align-items: center;
  background: rgba(17, 21, 27, 0.96);
  border: 1px solid var(--dw-hair);
  border-radius: var(--dw-radius-lg);
  bottom: calc(var(--dw-tabbar-h) + env(safe-area-inset-bottom) + 0.2rem);
  box-shadow: 0 0.18rem 0.48rem rgba(0, 0, 0, 0.45);
  display: flex;
  gap: 0.16rem;
  left: 0.24rem;
  padding: 0.16rem 0.2rem;
  position: fixed;
  right: 0.24rem;
  width: auto;
  z-index: 90;
  backdrop-filter: blur(10px);
}

.float-banner__icon {
  align-items: center;
  background: var(--dw-cyan);
  border-radius: var(--dw-radius-sm);
  color: var(--dw-ink-on-cyan);
  display: flex;
  font-size: 0.26rem;
  font-weight: 800;
  height: 0.64rem;
  justify-content: center;
  width: 0.64rem;
}

.float-banner__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: 0.24rem;
  line-height: 1.3;
  min-width: 0;
}

.float-banner__text strong {
  color: var(--dw-text);
  font-size: 0.28rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-banner__text span {
  color: var(--dw-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.float-banner__btn {
  background: var(--dw-cyan);
  border: none;
  border-radius: 999px;
  color: var(--dw-ink-on-cyan);
  flex-shrink: 0;
  font-size: 0.26rem;
  font-weight: 700;
  padding: 0.12rem 0.28rem;
}

.float-banner__close {
  background: transparent;
  border: none;
  color: var(--dw-faint);
  font-size: 0.36rem;
  line-height: 1;
  padding: 0 0.04rem;
}
</style>
