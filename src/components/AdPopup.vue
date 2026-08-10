<template>
  <div v-if="visible" class="popup-overlay" @click.self="close">
    <div class="popup-wrap">
      <a
        class="popup-card"
        :href="current.url || undefined"
        target="_blank"
        rel="noopener noreferrer"
        @click="onAdClick"
      >
        <img
          v-if="current.image"
          :src="current.image"
          alt=""
          class="popup-img"
        />
        <div v-else class="popup-built">
          <div class="popup-built__head">
            <div class="popup-built__logo">{{ current.logo }}</div>
            <div class="popup-built__title">{{ current.title }}</div>
          </div>
          <div class="popup-built__url">{{ current.url }}</div>
          <div class="popup-built__offer">{{ current.offer }}</div>
        </div>
      </a>
      <button class="popup-close" aria-label="关闭" @click.stop="close">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#333" stroke-width="2.5">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  popups: { type: Array, default: () => [] },
})

const visible = ref(true)
const index = ref(0)

const current = computed(() => props.popups[index.value] || props.popups[0] || {})

function close() {
  visible.value = false
  if (index.value < props.popups.length - 1) {
    setTimeout(() => {
      index.value++
      visible.value = true
    }, 300)
  }
}

function onAdClick(e) {
  if (!current.value.url) e.preventDefault()
}

onMounted(() => {
  visible.value = props.popups.length > 0
})
</script>

<style scoped>
.popup-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 200;
}

.popup-wrap {
  align-items: center;
  display: flex;
  flex-direction: column;
  width: 6.4rem;
  max-width: 92vw;
}

.popup-card {
  display: block;
  width: 100%;
  border-radius: 0.24rem;
  overflow: hidden;
  line-height: 0;
}

.popup-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
}

.popup-built {
  background: linear-gradient(180deg, #fff 0%, #1a6fd4 40%, #0d4a9e 100%);
  padding: 0.4rem;
  text-align: center;
}

.popup-built__head {
  align-items: center;
  display: flex;
  gap: 0.2rem;
  justify-content: center;
  margin-bottom: 0.2rem;
}

.popup-built__logo {
  background: linear-gradient(135deg, #2980b9, #c0392b);
  border-radius: 0.16rem;
  color: #fff;
  font-size: 0.4rem;
  font-weight: 800;
  padding: 0.12rem 0.2rem;
}

.popup-built__title {
  color: #c0392b;
  font-size: 0.56rem;
  font-weight: 800;
}

.popup-built__url {
  background: linear-gradient(90deg, #d4af37, #f1c40f);
  border-radius: 0.8rem;
  color: #fff;
  display: inline-block;
  font-size: 0.36rem;
  font-weight: 700;
  margin: 0.2rem 0;
  padding: 0.08rem 0.4rem;
}

.popup-built__offer {
  color: #fff;
  font-size: 0.8rem;
  font-weight: 900;
  margin: 0.3rem 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.popup-close {
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(0, 0, 0, 0.12);
  border-radius: 50%;
  display: flex;
  height: 0.85333rem;
  justify-content: center;
  margin-top: 0.32rem;
  width: 0.85333rem;
}
</style>
