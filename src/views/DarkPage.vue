<template>
  <TabShell active="dark">
    <div class="dark-page">
      <div class="tag-cloud">
        <button v-for="tag in tags" :key="tag" class="dark-tag" @click="onTag(tag)">{{ tag }}</button>
      </div>
    </div>
  </TabShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TabShell from '../components/TabShell.vue'
import feeds from '../data/feeds.json'
import tabsFallback from '../data/tabs.json'

const router = useRouter()
const tags = computed(() => feeds.dark?.tags?.length ? feeds.dark.tags : tabsFallback.dark.tags)

function onTag(tag) {
  router.push({ path: '/videosPage', query: { q: tag } })
}
</script>

<style scoped>
.dark-page { min-height: 70vh; padding: 1.2rem 0.32rem; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.24rem; justify-content: center; padding-top: 0.8rem; }
.dark-tag {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.15); border-radius: 0.8rem;
  color: rgba(255,255,255,.85); font-size: 0.36rem; padding: 0.2rem 0.4rem;
}
</style>
