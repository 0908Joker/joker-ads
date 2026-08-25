<template>
  <TabShell active="dark">
    <header class="dark-head">
      <span class="dark-head__tee" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8">
          <path d="M8 7l-3 2v10h14V9l-3-2"/>
          <path d="M8 7V5h8v2"/>
        </svg>
      </span>
      <div class="dark-search">
        <span>🔍</span>
        <span>学生</span>
      </div>
      <span class="dark-head__hist">⏱</span>
    </header>

    <section class="poster">
      <img src="/dark/poster.png" alt="" class="poster__img" />
    </section>

    <div class="tag-cloud">
      <button
        v-for="tag in tags"
        :key="tag"
        class="dark-tag"
        :class="{ 'is-active': activeTag === tag }"
        @click="onTag(tag)"
      >{{ tag }}</button>
    </div>

    <section v-if="results.length" class="results">
      <article
        v-for="(v, i) in results"
        :key="v.id || i"
        class="result-row"
        :class="{ 'result-row--tap': v.id }"
        @click="openVideo(v)"
      >
        <CebImg class="result-row__cover" :path="v.coverLocal || v.cover" />
        <div>
          <p>{{ v.views }} · {{ v.duration }}</p>
          <h3>{{ v.title }}</h3>
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

const tags = tabsFallback.dark.tags.slice(0, 8)
const activeTag = ref('')
const results = ref([])
const router = useRouter()

function openVideo(v) {
  if (!v?.id) return
  router.push(`/play/${v.id}`)
}

async function onTag(tag) {
  activeTag.value = tag
  try {
    const raw = await fetchTagVideosByName({ page: 1, pageSize: 12, name: tag })
    results.value = normalizeFeaturedPayload(raw.data ?? raw)
  } catch {
    results.value = []
  }
}
</script>

<style scoped>
.dark-head {
  align-items: center;
  background: #ff2d55;
  display: flex;
  gap: 0.16rem;
  padding: 0.2rem 0.24rem;
}
.dark-head__tee, .dark-head__hist {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: 0.64rem;
  justify-content: center;
  width: 0.64rem;
}
.dark-head__hist { color: #fff; font-size: 0.4rem; }
.dark-search {
  align-items: center;
  background: #f2f2f2;
  border-radius: 0.8rem;
  color: #999;
  display: flex;
  flex: 1;
  font-size: 0.32rem;
  gap: 0.12rem;
  padding: 0.12rem 0.24rem;
}
.poster { padding: 0.16rem 0.28rem 0.08rem; }
.poster__img {
  border: 3px solid #ff2d55;
  border-radius: 0.16rem;
  display: block;
  width: 100%;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.16rem;
  justify-content: center;
  padding: 0.16rem 0.32rem 0.48rem;
}
.dark-tag {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.15);
  border-radius: 0.8rem;
  color: rgba(255,255,255,.85);
  font-size: 0.32rem;
  padding: 0.16rem 0.32rem;
}
.dark-tag.is-active { background: rgba(255,45,85,.2); border-color: #ff2d55; }
.results { padding: 0 0.32rem 0.48rem; }
.result-row { align-items: center; display: flex; gap: 0.2rem; margin-bottom: 0.2rem; }
.result-row--tap { cursor: pointer; }
.result-row--tap:active { opacity: 0.75; }
.result-row__cover { background: #222; border-radius: 0.1rem; height: 1.2rem; object-fit: cover; width: 2rem; }
.result-row p { color: rgba(255,255,255,.45); font-size: 0.24rem; }
.result-row h3 { font-size: 0.3rem; }
</style>
