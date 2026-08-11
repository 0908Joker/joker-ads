<template>
  <TabShell active="dark">
    <div class="dark-page">
      <div class="tag-cloud">
        <button v-for="tag in tags" :key="tag" class="dark-tag" :class="{ 'is-active': activeTag === tag }" @click="onTag(tag)">{{ tag }}</button>
      </div>
      <section v-if="results.length" class="results">
        <article v-for="(v, i) in results" :key="v.id || i" class="result-row">
          <img v-if="v.cover" :src="v.cover" alt="" class="result-row__cover" />
          <div v-else class="result-row__cover result-row__cover--ph" />
          <div>
            <p class="result-row__stats">{{ v.views }} · {{ v.duration }}</p>
            <h3>{{ v.title }}</h3>
          </div>
        </article>
      </section>
    </div>
  </TabShell>
</template>

<script setup>
import { ref, computed } from 'vue'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'
import { fetchVideoFilter } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'

const NOISE = /应用|精选|抖阴|暗网|圈子|二次元|我的|tabbar/i

const tags = computed(() => {
  const raw = feeds.dark?.tags?.length ? feeds.dark.tags : tabsFallback.dark.tags
  return raw.filter((t) => t && t.length <= 6 && !NOISE.test(t))
})

const activeTag = ref('')
const results = ref([])

async function onTag(tag) {
  activeTag.value = tag
  try {
    const raw = await fetchVideoFilter({ tag, page: 1, pageSize: 12 })
    const list = normalizeFeaturedPayload(raw.data ?? raw)
    results.value = list
  } catch {
    results.value = []
  }
}
</script>

<style scoped>
.dark-page { min-height: 70vh; padding: 1.2rem 0.32rem; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.24rem; justify-content: center; padding-top: 0.8rem; }
.dark-tag {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.15); border-radius: 0.8rem;
  color: rgba(255,255,255,.85); font-size: 0.36rem; padding: 0.2rem 0.4rem;
}
.dark-tag.is-active { background: rgba(255,45,85,.2); border-color: #ff2d55; color: #fff; }
.results { margin-top: 0.48rem; }
.result-row { align-items: center; display: flex; gap: 0.24rem; margin-bottom: 0.24rem; }
.result-row__cover { border-radius: 0.12rem; height: 1.2rem; object-fit: cover; width: 2rem; }
.result-row__cover--ph { background: #222; }
.result-row__stats { color: rgba(255,255,255,.45); font-size: 0.24rem; }
.result-row h3 { font-size: 0.3rem; line-height: 1.35; }
</style>
