<template>
  <div v-if="visible" class="popup-overlay" @click.self="close">
    <div v-if="mode === 'grid'" class="grid-wrap">
      <div class="grid-panel">
        <div class="grid-head">
          <h2 class="grid-title">精品APP</h2>
        </div>
        <div class="grid-ads">
          <a
            v-for="(ad, i) in gridAds"
            :key="`${ad.name}-${i}`"
            class="grid-ad"
            :href="resolveAdTarget(ad) || undefined"
            target="_blank"
            rel="noopener noreferrer"
            @click="trackAdInteraction(ad, 'gridPopAds')"
          >
            <CebImg class="grid-ad__img" :path="ad.image || ad.coverUrl" />
          </a>
        </div>
      </div>
    </div>
    <div v-else-if="currentSrc" class="popup-wrap">
      <a
        class="popup-card"
        :href="currentHref || undefined"
        target="_blank"
        rel="noopener noreferrer"
        @click="onAdClick"
      >
        <img :src="currentSrc" alt="" class="popup-img" @error="onImageError" />
      </a>
    </div>
    <button class="popup-close" aria-label="关闭" @click.stop="close">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#333" stroke-width="2.5">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import CebImg from './CebImg.vue'
import { decryptMedia } from '../api/media.js'
import { resolveAdTarget, trackAdInteraction } from '../api/ad.js'
import { useSiteConfig } from '../composables/useSiteConfig.js'
import popupFallback from '../data/popups.json'

// Survive remount when leaving /play (App v-if); avoid endless re-queue.
let sessionQueueDone = false
let sessionIndex = 0
let showGen = 0
let nextTimer = null

const props = defineProps({
  popups: { type: Array, default: () => [] },
})

const siteConfig = useSiteConfig()
const popupData = computed(() => siteConfig.popups?.afterEnterApp ? siteConfig.popups : popupFallback)

const afterAds = computed(() => {
  const fromFile = popupData.value.afterEnterApp
  if (Array.isArray(fromFile)) return fromFile
  return (props.popups.length ? props.popups : siteConfig.config.popups || []).map((p) => ({
    name: p.name,
    url: p.url,
    signUrl: p.signUrl,
    coverUrl: p.image || p.coverUrl,
  }))
})

const gridAds = computed(() => popupData.value.gridPopAds || [])

const index = ref(sessionIndex)
const mode = ref('image')
const visible = ref(false)
const currentSrc = ref('')
const currentHref = ref('')
const currentAd = ref(null)

const queueLen = computed(() => afterAds.value.length + (gridAds.value.length ? 1 : 0))

async function showAt(i) {
  const gen = ++showGen
  clearTimeout(nextTimer)
  visible.value = false
  currentSrc.value = ''
  currentHref.value = ''
  currentAd.value = null
  index.value = i
  sessionIndex = i
  if (i >= queueLen.value) { markDone(); return }
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
  try {
    const src = await decryptMedia(ad.image || ad.coverUrl)
    if (gen !== showGen) return
    currentAd.value = ad
    currentHref.value = resolveAdTarget(ad)
    currentSrc.value = src
    visible.value = Boolean(src)
    if (!src) showAt(i + 1)
  } catch {
    if (gen !== showGen) return
    showAt(i + 1)
  }
}

const DONE_KEY = 'adPopupDone'

function markDone() {
  ++showGen
  clearTimeout(nextTimer)
  visible.value = false
  currentAd.value = null
  sessionQueueDone = true
  try {
    sessionStorage.setItem(DONE_KEY, '1')
  } catch {}
}

function close() {
  const gen = ++showGen
  visible.value = false
  index.value += 1
  sessionIndex = index.value
  if (index.value < queueLen.value) {
    nextTimer = setTimeout(() => { if (gen === showGen) void showAt(index.value) }, 280)
    return
  }
  markDone()
}

function onAdClick(e) {
  if (!currentHref.value || !currentAd.value) {
    e.preventDefault()
    return
  }
  trackAdInteraction(currentAd.value, 'afterEnterApp')
}

function onImageError(event) {
  if (!visible.value || !currentSrc.value) return
  if (event?.target?.currentSrc && event.target.currentSrc !== new URL(currentSrc.value, location.href).href) return
  void showAt(index.value + 1)
}

function refreshPopupConfig() {
  // Update an open/queued ad, but do not reopen a queue the user already closed.
  if (sessionQueueDone) return
  void showAt(Math.min(index.value, queueLen.value))
}

watch(() => [afterAds.value, gridAds.value], refreshPopupConfig)

onBeforeUnmount(() => { ++showGen; clearTimeout(nextTimer) })

onMounted(() => {
  try {
    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionQueueDone) return
  } catch {
    if (sessionQueueDone) return
  }
  showAt(sessionIndex)
})
</script>

<style scoped>
.popup-overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.78);
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.grid-panel {
  background: #10141c;
  border-radius: 0.36rem;
  isolation: isolate;
  overflow: hidden;
  padding: 0 0 0.28rem;
  position: relative;
  width: 100%;
}
.grid-panel::before {
  background: linear-gradient(180deg, #00d4ff 0%, #1a8fb0 48%, #0a3040 100%);
  border-radius: 0.4rem;
  content: '';
  inset: -0.06rem;
  position: absolute;
  z-index: -1;
}
.grid-head {
  align-items: center;
  display: flex;
  height: 1.36rem;
  justify-content: center;
}
.grid-title {
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1;
  margin: 0;
  text-shadow:
    0 0 4px #ff4da6,
    0 0 10px #ff2d95,
    0 0 18px #ff2d95;
}
.grid-ads {
  display: grid;
  gap: 0.16rem 0.14rem;
  grid-template-columns: repeat(4, 1fr);
  max-height: 9.2rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.08rem 0.28rem 0.12rem;
}
.grid-ad {
  display: block;
  line-height: 0;
  text-decoration: none;
}
.grid-ad__img,
:deep(.grid-ad__img) {
  aspect-ratio: 1;
  border-radius: 0.22rem;
  display: block;
  overflow: hidden;
  width: 100%;
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
  margin: 0;
  width: 32px;
}
</style>
