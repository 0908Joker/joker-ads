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
      <div v-if="detail.tags.length" class="play__tags">
        <span v-for="t in detail.tags" :key="t">#{{ t }}</span>
      </div>
    </section>

    <section v-if="detail?.others?.length" class="play__more">
      <h2>相关推荐</h2>
      <article
        v-for="v in detail.others"
        :key="v.id"
        class="more-row"
        @click="openVideo(v.id)"
      >
        <CebImg class="more-row__cover" :path="v.cover" />
        <div class="more-row__body">
          <h3>{{ v.title }}</h3>
          <p>{{ v.views }} · {{ v.duration }}</p>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CebImg from '../components/CebImg.vue'
import { fetchVideoDetail } from '../api/videos.js'
import { proxyMediaUrl } from '../api/client.js'
import { normalizeVideoDetail } from '../api/normalize.js'
import { decryptMedia } from '../api/media.js'

const route = useRoute()
const router = useRouter()
const videoEl = ref(null)
const detail = ref(null)
const poster = ref('')
const status = ref('加载中…')
let hls = null

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/videosPage')
}

function openVideo(id) {
  if (id) router.push(`/play/${id}`)
}

function onVideoError() {
  if (!status.value) status.value = '视频加载失败，请稍后重试'
}

function destroyPlayer() {
  if (hls) {
    hls.destroy()
    hls = null
  }
}

async function attachStream(url) {
  const el = videoEl.value
  if (!el || !url) return
  destroyPlayer()

  const isHls = /\.m3u8(\?|$)/i.test(url)
  if (!isHls) {
    el.src = url
    return
  }
  // Prefer hls.js wherever MSE exists: Chromium reports "maybe" for the HLS
  // MIME type but cannot actually play it, so canPlayType must not decide first.
  const { default: Hls } = await import('hls.js')
  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true })
    hls.loadSource(url)
    hls.attachMedia(el)
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) status.value = '视频加载失败，请稍后重试'
    })
    return
  }
  if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url
    return
  }
  status.value = '当前浏览器不支持该视频格式'
}

async function load() {
  const id = route.params.id
  if (!id) return
  status.value = '加载中…'
  detail.value = null
  poster.value = ''
  try {
    const raw = await fetchVideoDetail(id)
    const d = normalizeVideoDetail(raw.data ?? raw)
    if (!d || !d.playUrl) {
      status.value = '未获取到播放地址'
      return
    }
    detail.value = d
    status.value = ''
    decryptMedia(d.cover)
      .then((src) => (poster.value = src))
      .catch(() => {})
    await attachStream(proxyMediaUrl(d.playUrl))
  } catch (e) {
    status.value = '加载失败，请稍后重试'
  }
}

onMounted(load)
watch(() => route.params.id, load)
onBeforeUnmount(destroyPlayer)
</script>

<style scoped>
.play {
  background: #111;
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
  background: none;
  border: none;
  color: #fff;
  font-size: 0.56rem;
  line-height: 1;
  padding: 0 0.12rem;
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
  background: rgba(248, 25, 66, 0.12);
  border-radius: 0.1rem;
  color: #ff6b8a;
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
  background: rgb(44, 44, 47);
  border-radius: 0.8rem;
  color: rgb(153, 153, 153);
  font-size: 0.24rem;
  padding: 0.08rem 0.18rem;
}
.play__more {
  padding: 0.1rem 0.32rem 0.4rem;
}
.play__more h2 {
  color: #fff;
  font-size: 0.3rem;
  margin-bottom: 0.16rem;
}
.more-row {
  display: flex;
  gap: 0.2rem;
  margin-bottom: 0.2rem;
}
.more-row__cover {
  border-radius: 0.1rem;
  flex-shrink: 0;
  height: 1.4rem;
  overflow: hidden;
  width: 2.2rem;
}
.more-row__body {
  flex: 1;
  min-width: 0;
}
.more-row__body h3 {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #fff;
  display: -webkit-box;
  font-size: 0.28rem;
  line-height: 1.35;
  overflow: hidden;
}
.more-row__body p {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.24rem;
  margin-top: 0.08rem;
}
</style>
