<template>
  <TabShell active="dark">
    <header class="dark-head">
      <span class="dark-head__tee" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8">
          <path d="M8 7l-3 2v10h14V9l-3-2"/>
          <path d="M8 7V5h8v2"/>
        </svg>
      </span>
      <SearchBar class="dark-head__search" :words="['学生', '强奸', '自慰', '妈妈']" to="/searchPage" />
      <span class="dark-head__hist">⏱</span>
    </header>

    <section class="poster" @click="goRecharge">
      <img src="/dark/poster.png" alt="" class="poster__img" />
      <div class="poster__vip">开通VIP解锁暗网专区</div>
    </section>

    <div class="sub-tabs">
      <button
        v-for="s in subTabs"
        :key="s"
        class="sub-tab"
        :class="{ 'is-active': subTab === s }"
        @click="subTab = s"
      >{{ s }}</button>
    </div>

    <div class="tag-cloud">
      <button
        v-for="tag in tags"
        :key="tag"
        class="dark-tag"
        :class="{ 'is-active': activeTag === tag }"
        @click="onTag(tag)"
      >{{ tag }}</button>
    </div>

    <section class="results">
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
      <p v-if="!results.length && !loading" class="feed-status">选择标签或切换排序浏览内容</p>
      <p v-if="loading" class="feed-status">加载中…</p>
    </section>
  </TabShell>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import CebImg from '../components/CebImg.vue'
import tabsFallback from '../data/tabs.json'
import { fetchRecommend, fetchTagVideosByName } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'

const tags = tabsFallback.dark.tags.slice(0, 8)
const subTabs = ['推荐', '最新', '最热']
const activeTag = ref('')
const subTab = ref('推荐')
const results = ref([])
const loading = ref(false)
const router = useRouter()

function openVideo(v) {
  if (!v?.id) return
  router.push(`/play/${v.id}`)
}

function goRecharge() {
  router.push('/recharge?type=vip')
}

function sortList(list) {
  if (subTab.value !== '最热') return list
  return [...list].sort((a, b) => {
    const av = Number(String(a.views || '0').replace(/[^\d.]/g, '')) || 0
    const bv = Number(String(b.views || '0').replace(/[^\d.]/g, '')) || 0
    return bv - av
  })
}

async function loadFeed() {
  loading.value = true
  try {
    if (activeTag.value) {
      const raw = await fetchTagVideosByName({ page: 1, pageSize: 16, name: activeTag.value })
      results.value = normalizeFeaturedPayload(raw.data ?? raw)
    } else {
      const page = subTab.value === '最新' ? 2 : subTab.value === '最热' ? 3 : 1
      const sort = subTab.value === '最新' ? 'latest' : subTab.value === '最热' ? 'hot' : 'recommend'
      const raw = await fetchRecommend({ page, pageSize: 16, sort })
      results.value = sortList(normalizeFeaturedPayload(raw.data ?? raw))
    }
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

async function onTag(tag) {
  activeTag.value = activeTag.value === tag ? '' : tag
  await loadFeed()
}

watch(subTab, () => {
  if (!activeTag.value) loadFeed()
})

loadFeed()
</script>

<style scoped>
.dark-head {
  align-items: center;
  background: #ff2d55;
  display: flex;
  gap: 0.12rem;
  padding: 0.12rem 0.2rem;
}
.dark-head__tee,
.dark-head__hist {
  align-items: center;
  color: #fff;
  display: flex;
  flex-shrink: 0;
  font-size: 0.4rem;
  height: 0.64rem;
  justify-content: center;
  width: 0.64rem;
}
:deep(.dark-head__search.search-bar),
.dark-head :deep(.search-bar) {
  background: #f2f2f2;
  flex: 1;
  margin: 0;
}
.dark-head :deep(.search-bar__icon),
.dark-head :deep(.search-bar__word) {
  color: #999;
}
.poster {
  cursor: pointer;
  padding: 0.16rem 0.28rem 0.08rem;
  position: relative;
}
.poster__img {
  border: 3px solid #ff2d55;
  border-radius: 0.16rem;
  display: block;
  width: 100%;
}
.poster__vip {
  background: rgba(0, 0, 0, 0.55);
  border-radius: 0.8rem;
  bottom: 0.28rem;
  color: #ffd24a;
  font-size: 0.28rem;
  left: 50%;
  padding: 0.12rem 0.28rem;
  position: absolute;
  transform: translateX(-50%);
}
.sub-tabs {
  display: flex;
  gap: 0.16rem;
  padding: 0.12rem 0.32rem;
}
.sub-tab {
  background: rgba(255, 255, 255, 0.06);
  border: none;
  border-radius: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.28rem;
  padding: 0.1rem 0.24rem;
}
.sub-tab.is-active {
  background: #ff2d55;
  color: #fff;
  font-weight: 600;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.16rem;
  justify-content: center;
  padding: 0.08rem 0.32rem 0.24rem;
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
.feed-status { color: rgba(255,255,255,.45); font-size: 0.26rem; padding: 0.24rem 0; text-align: center; }
</style>
