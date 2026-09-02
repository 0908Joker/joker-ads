<template>
  <div class="sub-page">
    <header class="sub-page__head">
      <button class="sub-page__back" aria-label="返回" @click="router.back()">‹</button>
      <h1>{{ title }}</h1>
    </header>
    <div class="sub-page__body">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

defineProps({ title: { type: String, default: '' } })

const router = useRouter()
</script>

<style scoped>
.sub-page {
  background: var(--dw-bg);
  color: var(--dw-text);
  min-height: 100vh;
  padding-bottom: 0.8rem;
}
.sub-page__head {
  align-items: center;
  background: rgba(9, 11, 14, 0.92);
  border-bottom: 1px solid var(--dw-hair);
  display: flex;
  gap: 0.16rem;
  padding: 0.24rem var(--dw-pad-x) 0.26rem;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(12px);
}
.sub-page__back {
  background: var(--dw-surface-2);
  border: 1px solid var(--dw-hair);
  border-radius: 50%;
  color: var(--dw-text);
  font-size: 0.44rem;
  height: 0.72rem;
  line-height: 0.64rem;
  padding: 0;
  width: 0.72rem;
}
.sub-page__head h1 {
  font-size: 0.34rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.sub-page__body {
  padding: 0.28rem var(--dw-pad-x);
}
</style>
