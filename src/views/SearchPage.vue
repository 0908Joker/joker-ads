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
import { fetchTagVideosByName } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'

const router = useRouter()
const keyword = ref('')
const results = ref([])
const loading = ref(false)
const tried = ref(false)
const hotWords = tabsFallback.featured?.chips?.slice(0, 8) || ['巨乳翘臀', '网红尤物', '约炮偷情']

function openVideo(v) {
  if (v?.id) router.push(`/play/${v.id}`)
}

async function run(q) {
  keyword.value = q
  await search()
}

async function search() {
  const q = keyword.value.trim()
  if (!q) return
  loading.value = true
  tried.value = true
  try {
    const raw = await fetchTagVideosByName({ page: 1, pageSize: 20, name: q })
    results.value = normalizeFeaturedPayload(raw.data ?? raw)
  } catch {
    results.value = []
  } finally {
    loading.value = false
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
  background: none;
  border: none;
  color: #fff;
  font-size: 0.56rem;
  line-height: 1;
}
.search-head__input {
  flex: 1;
}
.search-head__input input {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 0.8rem;
  color: #fff;
  font-size: 0.3rem;
  padding: 0.18rem 0.24rem;
  width: 100%;
}
.search-head__go {
  background: #f81942;
  border: none;
  border-radius: 0.8rem;
  color: #fff;
  font-size: 0.28rem;
  padding: 0.14rem 0.24rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.12rem;
  padding: 0 0.32rem 0.24rem;
}
.chip {
  background: #2a2a2a;
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
