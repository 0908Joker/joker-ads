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

const props = defineProps({
  title: { type: String, default: 'PG电子大放水' },
  subtitle: { type: String, default: '投注爆千万' },
  url: { type: String, default: '' },
  signUrl: { type: String, default: '' },
  btn: { type: String, default: '下载' },
})

const visible = ref(true)

function open() {
  const target = props.signUrl || props.url
  if (target?.startsWith('http')) window.open(target, '_blank')
}
</script>

<style scoped>
.float-banner {
  align-items: center;
  background: linear-gradient(90deg, #1a1a1a, #2a2018);
  border-radius: 0.16rem;
  bottom: calc(1.53846rem + env(safe-area-inset-bottom) + 0.16rem);
  display: flex;
  gap: 0.16rem;
  left: 0.2rem;
  padding: 0.16rem 0.24rem;
  position: fixed;
  right: 0.2rem;
  width: auto;
  z-index: 90;
}

.float-banner__icon {
  align-items: center;
  background: linear-gradient(135deg, #f39c12, #e67e22);
  border-radius: 0.12rem;
  color: #fff;
  display: flex;
  font-size: 0.28rem;
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
}

.float-banner__text strong {
  color: #fff;
  font-size: 0.28rem;
}

.float-banner__text span {
  color: rgba(255, 255, 255, 0.6);
}

.float-banner__btn {
  background: linear-gradient(180deg, #ffd700, #f39c12);
  border: none;
  border-radius: 0.8rem;
  color: #333;
  font-size: 0.28rem;
  font-weight: 700;
  padding: 0.12rem 0.32rem;
}

.float-banner__close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.36rem;
  line-height: 1;
  padding: 0 0.08rem;
}
</style>
