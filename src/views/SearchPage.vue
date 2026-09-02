<template>
  <TabShell active="">
    <header class="search-head">
      <button class="search-head__back" @click="router.back()">‹</button>
      <div class="search-head__input">
        <input v-model="keyword" type="search" placeholder="搜索视频、标签…" @keyup.enter="search" />
      </div>
      <button class="search-head__go" @click="search">搜索</button>
    </header>

    <div class="chips">
      <button v-for="w in hotWords" :key="w" class="chip" @click="run(w)">{{ w }}</button>
    </div>

    <section v-if="loading" class="status">搜索中…</section>
    <section v-else-if="!results.length && tried" class="status">暂无结果</section>
    <section v-else class="results">
      <article
        v-for="(v, i) in results"
        :key="v.id || i"
        class="row"
        @click="openVideo(v)"
      >
        <CebImg class="row__cover" :path="v.coverLocal || v.cover" />
        <div>
          <h3>{{ v.title }}</h3>
          <p>{{ v.views }} · {{ v.duration }}</p>
        </div>
      </article>
    </section>
  </TabShell>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import TabShell from '../components/TabShell.vue'
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import { fetchTagVideosByName, fetchRecommend } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'

const router = useRouter()
const keyword = ref('')
const results = ref([])
const loading = ref(false)
const tried = ref(false)
let loadToken = 0
const hotWords = tabsFallback.featured?.chips?.slice(0, 8) || ['巨乳翘臀', '网红尤物', '约炮偷情']

function openVideo(v) {
  if (v?.id) router.push(`/play/${v.id}`)
}

function matchKeyword(list, q) {
  const needle = q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  if (!needle) return []
  return (list || [])
    .filter((v) => {
      if (!v?.id) return false
      const hay = String(v.title || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
      return hay.includes(needle)
    })
    .slice(0, 20)
}

async function searchPool(q) {
  try {
    const mod = await import('../data/video-pool.json')
    const raw = mod.default || mod
    return matchKeyword(normalizeFeaturedPayload(raw), q)
  } catch {
    return []
  }
}

async function searchRecommend(q) {
  try {
    const raw = await fetchRecommend({ page: 1, pageSize: 40, sort: 'recommend' })
    return matchKeyword(normalizeFeaturedPayload(raw.data ?? raw), q)
  } catch {
    return []
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

async function run(q) {
  keyword.value = q
  await search()
}

async function search() {
  const q = keyword.value.trim()
  if (!q) return
  const token = ++loadToken
  loading.value = true
  tried.value = true
  try {
    // Origin tag API often empty/slow; race a short timeout then fall back to pool.
    let list = []
    try {
      const raw = await withTimeout(
        fetchTagVideosByName({ page: 1, pageSize: 20, name: q }),
        2500,
      )
      if (token !== loadToken) return
      list = normalizeFeaturedPayload(raw.data ?? raw).filter((v) => v?.id)
    } catch {
      list = []
    }
    if (!list.length) list = await searchPool(q)
    if (token !== loadToken) return
    if (!list.length) list = await searchRecommend(q)
    if (token !== loadToken) return
    results.value = list
  } catch {
    if (token !== loadToken) return
    results.value = []
  } finally {
    if (token === loadToken) loading.value = false
  }
}
</script>

<style scoped>
.search-head {
  align-items: center;
  display: flex;
  gap: 0.12rem;
  padding: 0.2rem 0.32rem;
}
.search-head__back {
  background: var(--dw-cyan-dim);
  border: 1px solid var(--dw-line);
  border-radius: 50%;
  color: var(--dw-cyan-soft);
  font-size: 0.48rem;
  height: 0.72rem;
  line-height: 0.64rem;
  width: 0.72rem;
}
.search-head__input {
  flex: 1;
}
.search-head__input input {
  background: rgba(0, 212, 255, 0.06);
  border: 1px solid rgba(0, 212, 255, 0.14);
  border-radius: 0.8rem;
  color: #fff;
  font-size: 0.3rem;
  padding: 0.18rem 0.24rem;
  width: 100%;
}
.search-head__go {
  background: var(--dw-cyan);
  border: none;
  border-radius: 0.8rem;
  color: #061018;
  font-size: 0.28rem;
  font-weight: 700;
  padding: 0.14rem 0.24rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.12rem;
  padding: 0 0.32rem 0.24rem;
}
.chip {
  background: var(--dw-surface-2);
  border: none;
  border-radius: 0.8rem;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.26rem;
  padding: 0.1rem 0.2rem;
}
.status {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.28rem;
  padding: 0.48rem;
  text-align: center;
}
.results {
  padding: 0 0.32rem 0.48rem;
}
.row {
  align-items: center;
  display: flex;
  gap: 0.16rem;
  margin-bottom: 0.2rem;
}
.row__cover {
  border-radius: 0.1rem;
  flex-shrink: 0;
  height: 1.2rem;
  object-fit: cover;
  width: 2rem;
}
.row h3 {
  font-size: 0.3rem;
  line-height: 1.35;
}
.row p {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.24rem;
  margin-top: 0.06rem;
}
</style>
