<template>
  <div class="play">
    <header class="play__bar">
      <button class="play__back" @click="goBack">‹</button>
      <span class="play__bar-title">{{ detail?.title || '播放' }}</span>
    </header>

    <div class="play__stage">
      <video
        ref="videoEl"
        class="play__video"
        controls
        playsinline
        autoplay
        :poster="poster || undefined"
        @error="onVideoError"
      />
      <p v-if="status" class="play__status">{{ status }}</p>
    </div>

    <section v-if="detail" class="play__meta">
      <h1>{{ detail.title }}</h1>
      <p class="play__stats">
        {{ detail.views }} 播放 · {{ detail.duration }}
        <template v-if="detail.user"> · {{ detail.user }}</template>
      </p>
      <p v-if="detail.isPreview || detail.needBuy" class="play__notice">
        当前为试看片源，完整版需在原站购买
      </p>
      <div v-if="detail.tags?.length" class="play__tags">
        <span v-for="t in detail.tags" :key="t">#{{ t }}</span>
      </div>
    </section>

    <section v-if="related.length" class="play__more">
      <h2>相关推荐</h2>
      <div class="more-grid">
        <article
          v-for="v in related"
          :key="v.id"
          class="more-card"
          @click="openVideo(v.id)"
        >
          <CebImg class="more-card__cover" :path="v.coverLocal || v.cover" />
          <h3>{{ v.title }}</h3>
          <p>{{ v.views }}<template v-if="v.duration"> · {{ v.duration }}</template></p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CebImg from '../components/CebImg.vue'
import { fetchRecommend, fetchVideoDetail } from '../api/videos.js'
import { proxyMediaUrl } from '../api/client.js'
import { normalizeFeaturedPayload, normalizeVideoDetail } from '../api/normalize.js'
import { decryptMedia } from '../api/media.js'

const RELATED_LIMIT = 12

const route = useRoute()
const router = useRouter()
const videoEl = ref(null)
const detail = ref(null)
const related = ref([])
const poster = ref('')
const status = ref('加载中…')
let hls = null
let loadSeq = 0

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/videosPage')
}

function openVideo(id) {
  if (id) router.push(`/play/${id}`)
}

function excludeCurrent(list, currentId) {
  return (list || []).filter((v) => v?.id && String(v.id) !== String(currentId))
}

async function loadRelated(currentId, fromDetail = []) {
  const seed = excludeCurrent(fromDetail, currentId).slice(0, RELATED_LIMIT)
  if (seed.length >= RELATED_LIMIT) {
    related.value = seed
    return
  }

  let extras = []
  try {
    const raw = await fetchRecommend({ page: '1', pageSize: String(RELATED_LIMIT + 4), sort: 'recommend' })
    extras = normalizeFeaturedPayload(raw.data ?? raw)
  } catch {
    extras = []
  }

  const merged = [...seed]
  for (const v of excludeCurrent(extras, currentId)) {
    if (merged.length >= RELATED_LIMIT) break
    if (merged.some((m) => m.id === v.id)) continue
    merged.push(v)
  }

  if (merged.length < RELATED_LIMIT) {
    try {
      const mod = await import('../data/video-pool.json')
      const pool = normalizeFeaturedPayload(mod.default || mod)
      for (const v of excludeCurrent(pool, currentId)) {
        if (merged.length >= RELATED_LIMIT) break
        if (merged.some((m) => m.id === v.id)) continue
        merged.push(v)
      }
    } catch {}
  }
  related.value = merged
}

function onVideoError() {
  if (!status.value) status.value = '视频加载失败，请稍后重试'
}

function destroyPlayer() {
  if (hls) {
    try {
      hls.destroy()
    } catch {}
    hls = null
  }
  const el = videoEl.value
  if (el) {
    try {
      el.pause()
    } catch {}
    el.removeAttribute('src')
    try {
      el.load()
    } catch {}
  }
}

async function attachStream(url) {
  const el = videoEl.value
  if (!el || !url) throw new Error('no media')
  destroyPlayer()

  const isHls = /\.m3u8(\?|$)/i.test(url)
  if (!isHls) {
    await new Promise((resolve, reject) => {
      const onOk = () => {
        cleanup()
        resolve()
      }
      const onErr = () => {
        cleanup()
        reject(new Error('mp4 error'))
      }
      const cleanup = () => {
        el.removeEventListener('loadeddata', onOk)
        el.removeEventListener('error', onErr)
      }
      el.addEventListener('loadeddata', onOk, { once: true })
      el.addEventListener('error', onErr, { once: true })
      el.src = url
      el.load()
    })
    return
  }
  // Prefer hls.js wherever MSE exists: Chromium reports "maybe" for the HLS
  // MIME type but cannot actually play it, so canPlayType must not decide first.
  const { default: Hls } = await import('hls.js')
  if (Hls.isSupported()) {
    await new Promise((resolve, reject) => {
      hls = new Hls({ enableWorker: true })
      hls.loadSource(url)
      hls.attachMedia(el)
      hls.on(Hls.Events.MANIFEST_PARSED, () => resolve())
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) reject(new Error('hls fatal'))
      })
    })
    return
  }
  if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url
    return
  }
  throw new Error('unsupported')
}

async function attachCandidates(urls) {
  const list = (urls || []).filter(Boolean)
  for (const raw of list) {
    try {
      await attachStream(proxyMediaUrl(raw))
      try {
        await videoEl.value?.play()
      } catch {}
      return true
    } catch {
      destroyPlayer()
      if (videoEl.value) {
        videoEl.value.removeAttribute('src')
        try {
          videoEl.value.load()
        } catch {}
      }
    }
  }
  return false
}

async function load() {
  const id = route.params.id
  const seq = ++loadSeq
  if (!id) {
    status.value = '加载失败，请稍后重试'
    return
  }
  status.value = '加载中…'
  detail.value = null
  related.value = []
  poster.value = ''
  destroyPlayer()
  try {
    const raw = await fetchVideoDetail(id)
    if (seq !== loadSeq) return
    const d = normalizeVideoDetail(raw.data ?? raw)
    if (!d || !d.playUrl) {
      if (d) detail.value = d
      status.value = d?.needBuy ? '需购买后观看，暂无试看' : '未获取到播放地址'
      await loadRelated(id, d?.others || [])
      return
    }
    detail.value = d
    status.value = ''
    decryptMedia(d.cover)
      .then((src) => {
        if (seq === loadSeq) poster.value = src
      })
      .catch(() => {})
    const ok = await Promise.all([
      attachCandidates(d.playCandidates?.length ? d.playCandidates : [d.playUrl]),
      loadRelated(id, d.others || []),
    ])
    if (seq !== loadSeq) return
    if (!ok[0]) status.value = '视频加载失败，请稍后重试'
  } catch (e) {
    if (seq !== loadSeq) return
    const msg = String(e?.message || e || '')
    // Gone from origin — don't advertise「下架」; jump to a live related card.
    if (/不存在|已下架|下架/.test(msg)) {
      status.value = '加载中…'
      await loadRelated(id, [])
      if (seq !== loadSeq) return
      const next = related.value.find((v) => v?.id && String(v.id) !== String(id))
      if (next?.id) {
        router.replace(`/play/${next.id}`)
        return
      }
      status.value = '加载失败，请稍后重试'
      return
    }
    status.value = msg && msg.length < 40 ? msg : '加载失败，请稍后重试'
    await loadRelated(id, [])
  }
}

onMounted(load)
watch(() => route.params.id, load)
onBeforeUnmount(destroyPlayer)
</script>

<style scoped>
.play {
  background: var(--dw-bg);
  min-height: 100vh;
  padding-bottom: 0.4rem;
}
.play__bar {
  align-items: center;
  display: flex;
  gap: 0.16rem;
  padding: 0.16rem 0.24rem;
}
.play__back {
  background: var(--dw-cyan-dim);
  border: 1px solid var(--dw-line);
  border-radius: 50%;
  color: var(--dw-cyan-soft);
  font-size: 0.48rem;
  height: 0.72rem;
  line-height: 0.64rem;
  padding: 0;
  width: 0.72rem;
}
.play__bar-title {
  color: #fff;
  font-size: 0.32rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.play__stage {
  background: #000;
  position: relative;
  width: 100%;
}
.play__video {
  aspect-ratio: 16 / 9;
  display: block;
  width: 100%;
}
.play__status {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.28rem;
  left: 0;
  position: absolute;
  text-align: center;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
}
.play__meta {
  padding: 0.24rem 0.32rem;
}
.play__meta h1 {
  color: #fff;
  font-size: 0.34rem;
  line-height: 1.4;
}
.play__stats {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.26rem;
  margin-top: 0.12rem;
}
.play__notice {
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.22);
  border-radius: 0.1rem;
  color: var(--dw-cyan-soft);
  font-size: 0.26rem;
  margin-top: 0.16rem;
  padding: 0.12rem 0.16rem;
}
.play__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.12rem;
  margin-top: 0.16rem;
}
.play__tags span {
  background: var(--dw-surface-2);
  border: 1px solid rgba(0, 212, 255, 0.12);
  border-radius: 0.8rem;
  color: var(--dw-muted);
  font-size: 0.24rem;
  padding: 0.08rem 0.18rem;
}
.play__more {
  padding: 0.1rem 0.24rem 0.48rem;
}
.play__more h2 {
  color: #fff;
  font-size: 0.3rem;
  margin-bottom: 0.16rem;
  padding: 0 0.08rem;
}
.more-grid {
  display: grid;
  gap: 0.2rem 0.16rem;
  grid-template-columns: 1fr 1fr;
}
.more-card {
  min-width: 0;
}
.more-card__cover {
  aspect-ratio: 16 / 10;
  background: var(--dw-surface);
  border-radius: 0.1rem;
  display: block;
  overflow: hidden;
  width: 100%;
}
.more-card h3 {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #fff;
  display: -webkit-box;
  font-size: 0.26rem;
  line-height: 1.35;
  margin-top: 0.1rem;
  overflow: hidden;
}
.more-card p {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.22rem;
  margin-top: 0.06rem;
}
</style>
