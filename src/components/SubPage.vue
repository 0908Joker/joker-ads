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
  background: #111;
  color: #fff;
  min-height: 100vh;
  padding-bottom: 0.8rem;
}
.sub-page__head {
  align-items: center;
  display: flex;
  gap: 0.16rem;
  padding: 0.24rem 0.32rem 0.32rem;
}
.sub-page__back {
  background: none;
  border: none;
  color: #fff;
  font-size: 0.56rem;
  line-height: 1;
  padding: 0 0.12rem;
}
.sub-page__head h1 {
  font-size: 0.4rem;
}
.sub-page__body {
  padding: 0 0.32rem;
}
</style>
