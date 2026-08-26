<template>
  <div class="application">
    <HeroHeader
      :categories="config.categories"
      :modes="config.modes"
      @category-change="onCategoryChange"
      @mode-change="onModeChange"
    />
    <PromoBanner v-bind="config.promo || {}" />

    <main class="content content--with-tabbar">
      <p class="apps-meta">{{ activeCategory }} · {{ visibleApps.length }} 个应用</p>
      <AppGrid :apps="visibleApps" @open="onAppClick" />
      <p v-if="!visibleApps.length" class="apps-empty">该分类暂无应用</p>
    </main>

    <FloatBanner v-bind="config.floatBanner || {}" />
    <TabBar :items="config.tabbar" :active="activeTab" @change="onTabChange" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import config from '../data/config.json'
import tabs from '../data/tabs.json'
import HeroHeader from '../components/HeroHeader.vue'
import PromoBanner from '../components/PromoBanner.vue'
import AppGrid from '../components/AppGrid.vue'
import TabBar from '../components/TabBar.vue'
import FloatBanner from '../components/FloatBanner.vue'
import { openAd, resolveAdTarget } from '../api/ad.js'

const props = defineProps({
  initialTab: { type: String, default: 'apps' },
})

const router = useRouter()
const route = useRoute()
const activeTab = ref(props.initialTab)
const activeCategory = ref('官方推荐')
const activeMode = ref('recommend')

const appByName = new Map(config.apps.map((a) => [a.name, a]))

function resolveNames(names) {
  return names.map((name) => appByName.get(name)).filter(Boolean)
}

const visibleApps = computed(() => {
  const cat = activeCategory.value
  const catNames = config.categoryApps?.byCategory?.[cat] || []
  let names = [...catNames]

  if (activeMode.value === 'download') {
    const modeNames = config.categoryApps?.modes?.['热门下载'] || []
    if (modeNames.length) {
      const modeSet = new Set(modeNames)
      names = catNames.filter((n) => modeSet.has(n))
    }
  } else {
    const byCatRec = config.categoryApps?.modesByCategory?.[cat]?.['站长推荐']
    if (byCatRec?.length) {
      names = byCatRec
    } else if (cat === '官方推荐') {
      const globalRec = config.categoryApps?.modes?.['站长推荐'] || []
      if (globalRec.length) {
        const recSet = new Set(globalRec)
        const preferred = catNames.filter((n) => recSet.has(n))
        if (preferred.length) names = preferred
      }
    }
  }

  return resolveNames(names)
})

function onCategoryChange(cat) {
  activeCategory.value = cat
}

function onModeChange(mode) {
  activeMode.value = mode
}

function onAppClick(app) {
  if (openAd(app)) return
  const target = resolveAdTarget(app)
  if (target.startsWith('/')) {
    router.push(target)
    return
  }
  const internal = app.internalRoute || config.internalRoutes?.[app.name]
  if (internal) router.push(internal)
}

function onTabChange(id) {
  activeTab.value = id
  const path = tabs.routes[id] || '/appcenter'
  if (route.path !== path) router.push(path)
}

watch(
  () => props.initialTab,
  (tab) => {
    if (tab) activeTab.value = tab
  },
)
</script>

<style scoped>
.application {
  background: #111;
  min-height: 100vh;
}

.content {
  background: #111;
}

.content--with-tabbar {
  padding-bottom: calc(1.53846rem + env(safe-area-inset-bottom) + 1.2rem);
}

.apps-meta {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.26rem;
  padding: 0.12rem 0.32rem 0.08rem;
}

.apps-empty {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.3rem;
  padding: 1.2rem 0.32rem;
  text-align: center;
}
</style>
