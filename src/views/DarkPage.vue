<template>
  <TabShell active="dark">
    <SearchBar :words="['学生']" trailing="⏱" />
    <section class="poster">
      <header class="poster__head">
        <h1>打破您的认知</h1>
        <h2>全球封杀资源</h2>
        <p>您想看的这里全都有!</p>
      </header>
      <div class="poster__grid">
        <article class="tile tile--wide">世界性地「萝莉岛」</article>
        <article class="tile">盘点女神级「封杀」事件</article>
        <article class="tile tile--warn">⚠️突破道德禁区 稀缺资源</article>
        <article class="tile">「吹牛老爹」Diddy 惊天丑闻曝光</article>
        <article class="tile">台南版 N号房 VS 韩国 N号房</article>
      </div>
      <p class="poster__note">累计超过500w秘密资源 内容过于真实且全球封禁内容 仅供会员观看</p>
      <button class="poster__cta">立即开通</button>
    </section>
    <div class="tag-cloud">
      <button v-for="tag in tags" :key="tag" class="dark-tag" :class="{ 'is-active': activeTag === tag }" @click="onTag(tag)">{{ tag }}</button>
    </div>
    <section v-if="results.length" class="results">
      <article v-for="(v, i) in results" :key="v.id || i" class="result-row">
        <div class="result-row__cover" />
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
import TabShell from '../components/TabShell.vue'
import SearchBar from '../components/SearchBar.vue'
import tabsFallback from '../data/tabs.json'
import { fetchVideoFilter } from '../api/videos.js'
import { normalizeFeaturedPayload } from '../api/normalize.js'

const tags = tabsFallback.dark.tags.slice(0, 8)
const activeTag = ref('')
const results = ref([])

async function onTag(tag) {
  activeTag.value = tag
  try {
    const raw = await fetchVideoFilter({ tag, page: 1, pageSize: 12 })
    results.value = normalizeFeaturedPayload(raw.data ?? raw)
  } catch {
    results.value = []
  }
}
</script>

<style scoped>
.poster {
  background: linear-gradient(180deg, #2a1020, #111);
  border: 2px solid #ff2d55;
  border-radius: 0.24rem;
  margin: 0.16rem 0.32rem 0.32rem;
  padding: 0.32rem 0.24rem 0.4rem;
}
.poster__head { text-align: center; }
.poster__head h1 { color: #ff6b8a; font-size: 0.52rem; letter-spacing: 0.04rem; }
.poster__head h2 { font-size: 0.48rem; margin-top: 0.08rem; }
.poster__head p { color: rgba(255,255,255,.7); font-size: 0.28rem; margin-top: 0.12rem; }
.poster__grid { display: grid; gap: 0.16rem; grid-template-columns: 1fr 1fr; margin-top: 0.28rem; }
.tile {
  background: rgba(255,255,255,.06); border-radius: 0.12rem; font-size: 0.26rem; min-height: 1.4rem; padding: 0.2rem;
}
.tile--wide { grid-column: 1 / -1; }
.tile--warn { background: #f1c40f; color: #111; font-weight: 700; }
.poster__note { color: rgba(255,255,255,.55); font-size: 0.24rem; margin-top: 0.24rem; text-align: center; }
.poster__cta {
  background: #ff2d55; border: none; border-radius: 0.8rem; color: #fff; display: block;
  font-size: 0.36rem; font-weight: 700; margin: 0.28rem auto 0; padding: 0.2rem 1.2rem;
}
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.16rem; justify-content: center; padding: 0.16rem 0.32rem 0.48rem; }
.dark-tag {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.15); border-radius: 0.8rem;
  color: rgba(255,255,255,.85); font-size: 0.32rem; padding: 0.16rem 0.32rem;
}
.dark-tag.is-active { background: rgba(255,45,85,.2); border-color: #ff2d55; }
.results { padding: 0 0.32rem 0.48rem; }
.result-row { align-items: center; display: flex; gap: 0.2rem; margin-bottom: 0.2rem; }
.result-row__cover { background: #222; border-radius: 0.1rem; height: 1.2rem; width: 2rem; }
.result-row p { color: rgba(255,255,255,.45); font-size: 0.24rem; }
.result-row h3 { font-size: 0.3rem; }
</style>
