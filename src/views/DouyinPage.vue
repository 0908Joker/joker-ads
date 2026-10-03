<template>
  <TabShell active="douyin">
    <nav class="tabs">
      <button
        v-for="tab in tabList"
        :key="tab"
        class="tab"
        :class="{ 'is-active': activeTab === tab }"
        @click="activeTab = tab"
      >{{ tab }}</button>
    </nav>

    <section v-if="activeTab === '短剧'" class="drama-panel">
      <div class="hashtag-row">
        <span v-for="h in dramaTags" :key="h" class="hashtag">{{ h }}</span>
      </div>
      <div class="drama-scroll">
        <article v-for="(d, i) in dramaCards" :key="i" class="drama-card">
          <div class="drama-card__cover" />
          <p>{{ d.title }}</p>
        </article>
      </div>
    </section>

    <section ref="feedEl" class="short-feed">
      <article
        v-for="(item, i) in items"
        :key="`${activeTab}-${item.id || i}`"
        class="short-slide"
        :data-idx="i"
      >
        <CebImg
          class="short-slide__media short-slide__cover"
          :path="item.coverLocal || item.cover"
        />
        <video
          v-if="item.videoUrl && !item.videoFailed"
          class="short-slide__media short-slide__video"
          :poster="item.coverSrc || undefined"
          playsinline
          loop
          muted
        />

        <aside class="short-slide__side">
          <div class="side-avatar">
            <CebImg v-if="item.avatar" class="side-avatar__img" :path="item.avatar" />
            <span v-else>♥</span>
            <i>+</i>
          </div>
          <div class="side-act"><span>❤</span><small>{{ item.likes || 0 }}</small></div>
          <div class="side-act"><span>💬</span><small>{{ item.comments || 0 }}</small></div>
          <div class="side-act"><span>★</span><small>{{ item.collects || item.shares || 0 }}</small></div>
          <div class="side-act"><span>↗</span><small>分享</small></div>
          <div class="side-act"><span>¥</span><small>打赏</small></div>
          <div class="side-act"><span>🔇</span><small>打开</small></div>
          <div class="side-act"><span>🎧</span><small>客服</small></div>
        </aside>

        <div class="short-slide__overlay">
          <p class="short-slide__user">{{ item.user }}</p>
          <p class="short-slide__title">{{ item.title }}</p>
          <div v-if="item.tags?.length || item.hashtags?.length" class="short-slide__tags">
            <span v-for="t in (item.tags || item.hashtags)" :key="t">{{ t }}</span>
          </div>
        </div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import TabShell from '../components/TabShell.vue'
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import liveApi from '../data/live-api.json'
import shortCategories from '../data/short-categories.json'
import { fetchShortByCategorie, fetchShortAndImg } from '../api/videos.js'
import { normalizeShortPayload } from '../api/normalize.js'
import { proxyMediaUrl } from '../api/client.js'
import { decryptMedia } from '../api/media.js'
import { createPlaybackSession } from '../lib/playbackSession.js'

const tabList = tabsFallback.douyin.tabs
const activeTab = ref('抖阴')
const liveFallback = normalizeShortPayload(liveApi.short)
const items = ref([])
const feedEl = ref(null)
const dramaTags = ['#全部', '#玄幻', '#悬疑', '#甜宠', '#总裁', '#穿越', '#逆袭']
const dramaCards = ref([
  { title: '葡萄成熟时 第4集' },
  { title: '纯阳仙体第1集' },
  { title: '错位的爱人01' },
  { title: '废柴杂役第8集' },
])

/** idx → { hls, url, candidateIdx } for slides that currently have an attached stream */
const players = new Map()
let observer = null
let activeIdx = -1
let playSeq = 0
let loadController = null

function candidatesFor(item) {
  const list = Array.isArray(item?.playCandidates) ? item.playCandidates.filter(Boolean) : []
  if (list.length) return list
  return item?.videoUrl ? [item.videoUrl] : []
}

function hydrateShortList(list) {
  return list.map((v, i) => {
    const fb = tabsFallback.douyin.items[i % 2] || {}
    return { ...v, coverSrc: '', videoFailed: false,
      user: v.user && !/@saixi$/.test(v.user) ? v.user : fb.user,
      tags: v.hashtags?.length ? v.hashtags : fb.tags,
      shares: v.shares || fb.shares, collects: v.collects || fb.shares }
  })
}

function hydratePosters(seq, signal) {
  items.value.forEach((item, index) => {
    void decryptMedia(item.coverLocal || item.cover, { signal }).then(src => {
      if (seq === loadSeq && !signal.aborted && items.value[index] === item) item.coverSrc = src
    }).catch(() => {})
  })
}

function cachedShortForTab(tab) {
  const byTab = liveApi.shortByTab || {}
  if (byTab[tab] && !byTab[tab].error) {
    const list = normalizeShortPayload(byTab[tab])
    if (list.length) return list
  }
  if (tab === '抖阴' && liveFallback.length) return liveFallback
  return []
}

function tabFallbackItems(tab) {
  const cached = cachedShortForTab(tab)
  if (cached.length) return cached
  // Static labels only — never reuse another tab's feed as fallback.
  return tabsFallback.douyin.items.map((row, i) => ({
    ...row,
    id: `fallback-${tab}-${i}`,
    title: row.title,
    videoUrl: '',
    cover: '',
    coverLocal: '',
  }))
}

function destroyPlayer(idx) {
  const owned = players.get(idx)
  if (!owned) return
  players.delete(idx)
  owned.session.dispose()
}

function destroyAllPlayers() {
  ++playSeq
  for (const idx of [...players.keys()]) destroyPlayer(idx)
  activeIdx = -1
}

function videoElAt(idx) {
  const root = feedEl.value
  if (!root) return null
  return root.querySelector(`.short-slide[data-idx="${idx}"]`)?.querySelector('video') || null
}

async function playIdx(idx) {
  if (idx < 0 || idx >= items.value.length) return
  if (idx === activeIdx && players.has(idx)) return
  const item = items.value[idx]
  const candidates = candidatesFor(item)
  destroyAllPlayers()
  activeIdx = idx
  if (!candidates.length || item.videoFailed) return
  const epoch = playSeq, listEpoch = loadSeq, el = videoElAt(idx)
  if (!el?.isConnected) return
  el.muted = true
  const owned = { el, session: createPlaybackSession({
    getVideo: () => el.isConnected ? el : null, getSequence: () => playSeq,
    loadHls: () => import('hls.js'), proxy: proxyMediaUrl,
    onError: () => {
      if (listEpoch === loadSeq && epoch === playSeq && activeIdx === idx) item.videoFailed = true
    },
  }) }
  players.set(idx, owned)
  await owned.session.attachCandidates(candidates, epoch)
  if (epoch !== playSeq || listEpoch !== loadSeq || activeIdx !== idx || !el.isConnected) {
    owned.session.dispose()
    if (players.get(idx) === owned) players.delete(idx)
  }
}

function setupObserver() {
  observer?.disconnect()
  const root = feedEl.value
  if (!root) return
  observer = new IntersectionObserver(
    (entries) => {
      let best = null
      for (const e of entries) {
        if (!e.isIntersecting) continue
        if (!best || e.intersectionRatio > best.intersectionRatio) best = e
      }
      if (!best) return
      const idx = Number(best.target.getAttribute('data-idx'))
      if (Number.isFinite(idx)) playIdx(idx)
    },
    { root, threshold: [0.55, 0.75] },
  )
  root.querySelectorAll('.short-slide').forEach((el) => observer.observe(el))
}

let loadSeq = 0

async function loadShorts() {
  const seq = ++loadSeq
  loadController?.abort()
  loadController = new AbortController()
  const signal = loadController.signal
  const tab = activeTab.value
  const cate = (shortCategories.categories || []).find((c) => c.name === tab)
  destroyAllPlayers()
  items.value = []

  try {
    const raw = cate?.categorieId
      ? await fetchShortByCategorie({ page: 1, pageSize: 10, categorieId: cate.categorieId }, { signal })
      : await fetchShortAndImg({ page: 1, pageSize: 10, tab }, { signal })
    if (seq !== loadSeq) return
    const list = normalizeShortPayload(raw.data ?? raw)
    const hydrated = hydrateShortList(list.length ? list : tabFallbackItems(tab))
    if (seq !== loadSeq) return
    items.value = hydrated
  } catch {
    if (seq !== loadSeq) return
    const hydrated = hydrateShortList(tabFallbackItems(tab))
    if (seq !== loadSeq) return
    items.value = hydrated
  }

  hydratePosters(seq, signal)
  await nextTick()
  if (seq !== loadSeq) return
  setupObserver()
  void playIdx(0)
}

watch(activeTab, () => loadShorts(), { immediate: true })

onBeforeUnmount(() => {
  ++loadSeq
  loadController?.abort()
  observer?.disconnect()
  destroyAllPlayers()
})
</script>

<style scoped>
.tabs {
  display: flex; gap: 0.36rem; left: 0; overflow-x: auto; padding: 0.24rem 0.32rem;
  position: absolute; top: 0; white-space: nowrap; width: 100%; z-index: 3;
}
.tab { background: none; border: none; color: var(--dw-muted); font-size: 0.36rem; padding: 0.08rem 0.12rem; }
.tab.is-active { color: var(--dw-cyan-soft); font-weight: 700; text-shadow: 0 0 0.2rem rgba(0,212,255,0.35); }
.drama-panel { background: var(--dw-bg); padding: 1.1rem 0.32rem 0.16rem; position: relative; z-index: 2; }
.hashtag-row { display: flex; gap: 0.16rem; overflow-x: auto; white-space: nowrap; }
.hashtag { background: rgba(255,255,255,.08); border-radius: 0.8rem; color: rgba(255,255,255,.75); font-size: 0.26rem; padding: 0.08rem 0.2rem; }
.drama-scroll { display: flex; gap: 0.16rem; margin-top: 0.16rem; overflow-x: auto; }
.drama-card { flex-shrink: 0; width: 2.2rem; }
.drama-card__cover { aspect-ratio: 3/4; background: #222; border-radius: 0.12rem; }
.drama-card p { font-size: 0.24rem; margin-top: 0.08rem; }
.short-feed {
  height: calc(100vh - var(--dw-tabbar-h) - env(safe-area-inset-bottom));
  overflow-y: auto; scroll-snap-type: y mandatory;
}
.short-slide {
  background: var(--dw-bg);
  height: calc(100vh - var(--dw-tabbar-h) - env(safe-area-inset-bottom));
  position: relative; scroll-snap-align: start; width: 100%;
}
.short-slide__media { height: 100%; object-fit: cover; width: 100%; }
.short-slide__cover { inset: 0; position: absolute; }
.short-slide__video { inset: 0; position: absolute; z-index: 1; }
.short-slide__side {
  align-items: center; bottom: 2.4rem; display: flex; flex-direction: column; gap: 0.28rem;
  position: absolute; right: 0.16rem; z-index: 2;
}
.side-avatar {
  align-items: center; background: var(--dw-cyan); border-radius: 50%; display: flex; font-size: 0.32rem;
  height: 0.96rem; justify-content: center; overflow: visible; position: relative; width: 0.96rem;
}
.side-avatar__img,
.side-avatar :deep(img) { border-radius: 50%; height: 100%; object-fit: cover; width: 100%; }
.side-avatar i {
  align-items: center; background: var(--dw-cyan-soft); border-radius: 50%; bottom: -0.08rem; color: #041018;
  display: flex; font-size: 0.22rem; font-style: normal; height: 0.36rem; justify-content: center;
  position: absolute; right: -0.04rem; width: 0.36rem;
}
.side-act { align-items: center; color: #fff; display: flex; flex-direction: column; font-size: 0.4rem; gap: 0.04rem; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.side-act small { font-size: 0.22rem; }
.short-slide__overlay {
  bottom: 1.2rem; color: #fff; left: 0; padding: 0 1.4rem 0 0.32rem; position: absolute;
  text-shadow: 0 1px 3px rgba(0,0,0,.7); z-index: 2;
}
.short-slide__user { font-size: 0.32rem; font-weight: 700; }
.short-slide__title {
  -webkit-box-orient: vertical; display: -webkit-box; font-size: 0.28rem; -webkit-line-clamp: 3;
  line-height: 1.4; margin-top: 0.08rem; overflow: hidden;
}
.short-slide__tags { display: flex; flex-wrap: wrap; gap: 0.12rem; margin-top: 0.12rem; }
.short-slide__tags span { color: var(--dw-cyan-soft); font-size: 0.26rem; }
</style>
