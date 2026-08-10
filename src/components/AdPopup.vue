<template>
  <div v-if="visible && current.image" class="popup-overlay" @click.self="close">
    <div class="popup-wrap">
      <a
        class="popup-card"
        :href="(current.signUrl || current.url) || undefined"
        target="_blank"
        rel="noopener noreferrer"
        @click="onAdClick"
      >
        <img
          :src="current.image"
          alt=""
          class="popup-img"
          @error="onImageError"
        />
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

const validPopups = computed(() =>
  props.popups.filter(
    (p) => p.image && /\.(gif|png|webp)$/i.test(p.image) && !/\/placeholder/i.test(p.image),
  ),
)

const brokenImages = ref(new Set())
const visible = ref(false)
const index = ref(0)

const playablePopups = computed(() =>
  validPopups.value.filter((p) => !brokenImages.value.has(p.image)),
)

const current = computed(() => playablePopups.value[index.value] || {})

function close() {
  visible.value = false
  if (index.value < playablePopups.value.length - 1) {
    setTimeout(() => {
      index.value++
      visible.value = Boolean(playablePopups.value[index.value]?.image)
    }, 300)
  }
}

function onImageError() {
  if (current.value.image) {
    brokenImages.value = new Set([...brokenImages.value, current.value.image])
  }
  if (index.value < playablePopups.value.length - 1) {
    index.value++
    visible.value = Boolean(playablePopups.value[index.value]?.image)
  } else {
    visible.value = false
  }
}

function onAdClick(e) {
  const target = current.value.signUrl || current.value.url
  if (!target) e.preventDefault()
}

onMounted(() => {
  visible.value = playablePopups.value.length > 0
})
</script>

<style scoped>
.popup-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  bottom: 0;
  justify-content: center;
  left: 50%;
  max-width: 430px;
  position: fixed;
  top: 0;
  transform: translateX(-50%);
  width: 100%;
  z-index: 200;
}

.popup-wrap {
  align-items: center;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  max-width: 86%;
  width: 6.4rem;
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
