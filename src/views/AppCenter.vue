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
    <TabBar :items="config.tabbar || []" :active="activeTab" @change="onTabChange" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSiteConfig } from '../composables/useSiteConfig.js'
import tabsFallback from '../data/tabs.json'
import HeroHeader from '../components/HeroHeader.vue'
import PromoBanner from '../components/PromoBanner.vue'
import AppGrid from '../components/AppGrid.vue'
import TabBar from '../components/TabBar.vue'
import FloatBanner from '../components/FloatBanner.vue'
import { openAd, resolveAdTarget } from '../api/ad.js'

const props = defineProps({
  initialTab: { type: String, default: 'apps' },
})

const siteConfig = useSiteConfig()
const config = computed(() => siteConfig.config)
const tabsData = computed(() => (siteConfig.tabs?.routes ? siteConfig.tabs : tabsFallback))
const router = useRouter()
const route = useRoute()
const activeTab = ref(props.initialTab)
const activeCategory = ref('官方推荐')
const activeMode = ref('recommend')

const appByName = computed(() => new Map((config.value.apps || []).map((a) => [a.name, a])))

function resolveNames(names) {
  return names.map((name) => appByName.value.get(name)).filter(Boolean)
}

const visibleApps = computed(() => {
  const cat = activeCategory.value
  const cfg = config.value
  const catNames = cfg.categoryApps?.byCategory?.[cat] || []
  let names = [...catNames]

  if (activeMode.value === 'download') {
    const modeNames = cfg.categoryApps?.modes?.['热门下载'] || []
    if (modeNames.length) {
      const modeSet = new Set(modeNames)
      names = catNames.filter((n) => modeSet.has(n))
    }
  } else {
    const byCatRec = cfg.categoryApps?.modesByCategory?.[cat]?.['站长推荐']
    if (byCatRec?.length) {
      names = byCatRec
    } else if (cat === '官方推荐') {
      const globalRec = cfg.categoryApps?.modes?.['站长推荐'] || []
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
  const internal = app.internalRoute || config.value.internalRoutes?.[app.name]
  if (internal) router.push(internal)
}

function onTabChange(id) {
  activeTab.value = id
  const path = tabsData.value.routes[id] || '/appcenter'
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
  background: var(--dw-bg);
  min-height: 100vh;
}

.content {
  background: transparent;
}

.content--with-tabbar {
  padding-bottom: calc(var(--dw-tabbar-h) + env(safe-area-inset-bottom) + 1.4rem);
}

.apps-meta {
  color: var(--dw-muted);
  font-size: 0.24rem;
  letter-spacing: 0.04em;
  padding: 0.2rem var(--dw-pad-x) 0.04rem;
}

.apps-empty {
  color: var(--dw-muted);
  font-size: 0.3rem;
  padding: 1.2rem var(--dw-pad-x);
  text-align: center;
}
</style>
