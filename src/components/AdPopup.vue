<template>
  <div v-if="visible" class="popup-overlay" @click.self="close">
    <div v-if="mode === 'grid'" class="grid-wrap">
      <div class="grid-bg" :style="{ backgroundImage: `url(${gridBg})` }">
        <div class="grid-ads">
          <a
            v-for="(ad, i) in gridAds"
            :key="`${ad.name}-${i}`"
            class="grid-ad"
            :href="ad.signUrl || ad.url || undefined"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CebImg class="grid-ad__img" :path="ad.coverUrl" />
            <span>{{ ad.name }}</span>
          </a>
        </div>
      </div>
      <button class="popup-close" aria-label="关闭" @click.stop="close">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#333" stroke-width="2.5">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </div>
    <div v-else-if="currentSrc" class="popup-wrap">
      <a
        class="popup-card"
        :href="currentHref || undefined"
        target="_blank"
        rel="noopener noreferrer"
        @click="onAdClick"
      >
        <img :src="currentSrc" alt="" class="popup-img" />
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
import CebImg from './CebImg.vue'
import { decryptMedia } from '../api/media.js'
import popupData from '../data/popups.json'
import config from '../data/config.json'

const props = defineProps({
  popups: { type: Array, default: () => [] },
})

const afterAds = computed(() => {
  const fromFile = popupData.afterEnterApp || []
  if (fromFile.length) return fromFile
  return (props.popups.length ? props.popups : config.popups || []).map((p) => ({
    name: p.name,
    url: p.url,
    signUrl: p.signUrl,
    coverUrl: p.image || p.coverUrl,
  }))
})

const gridAds = computed(() => popupData.gridPopAds || [])
const gridBg = '/popups/grid-bg.jpg'

const index = ref(0)
const mode = ref('image')
const visible = ref(false)
const currentSrc = ref('')
const currentHref = ref('')

const queueLen = computed(() => afterAds.value.length + (gridAds.value.length ? 1 : 0))

async function showAt(i) {
  if (i >= afterAds.value.length) {
    if (gridAds.value.length) {
      mode.value = 'grid'
      visible.value = true
      return
    }
    visible.value = false
    return
  }
  mode.value = 'image'
  const ad = afterAds.value[i]
  currentHref.value = ad.signUrl || ad.url || ''
  try {
    currentSrc.value = await decryptMedia(ad.coverUrl || ad.image)
    visible.value = Boolean(currentSrc.value)
    if (!currentSrc.value) showAt(i + 1)
  } catch {
    showAt(i + 1)
  }
}

function close() {
  visible.value = false
  index.value += 1
  if (index.value < queueLen.value) {
    setTimeout(() => showAt(index.value), 280)
  }
}

function onAdClick(e) {
  if (!currentHref.value) e.preventDefault()
}

onMounted(() => showAt(0))
</script>

<style scoped>
.popup-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.78);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 200;
}
.popup-wrap, .grid-wrap {
  align-items: center;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  max-width: min(88vw, 390px);
  width: 8.58667rem;
}
.popup-card {
  display: block;
  line-height: 0;
  overflow: hidden;
  width: 100%;
}
.popup-img {
  display: block;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  width: 100%;
}
.grid-bg {
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  height: 11.06667rem;
  position: relative;
  width: 8.58667rem;
}
.grid-ads {
  display: grid;
  gap: 0.2rem 0.16rem;
  grid-template-columns: repeat(4, 1fr);
  height: 7.33333rem;
  left: 0.48rem;
  overflow-y: auto;
  position: absolute;
  top: 3.25333rem;
  width: 7.68rem;
}
.grid-ad {
  align-items: center;
  color: #fff;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  width: 1.6rem;
}
.grid-ad__img {
  border-radius: 0.32rem;
  height: 1.28rem;
  overflow: hidden;
  width: 1.28rem;
}
.grid-ad span {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  display: -webkit-box;
  font-size: 0.26rem;
  line-height: 1.2;
  margin-top: 0.08rem;
  overflow: hidden;
  text-align: center;
}
.popup-close {
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(0, 0, 0, 0.12);
  border-radius: 50%;
  display: flex;
  flex-shrink: 0;
  height: 32px;
  justify-content: center;
  margin-top: 12px;
  width: 32px;
}
</style>
