<template>
  <div class="application">
    <HeroHeader
      :categories="config.categories"
      :modes="config.modes"
      @category-change="activeCategory = $event"
      @mode-change="activeMode = $event"
    />
    <PromoBanner v-bind="config.promo || {}" />

    <main class="content content--with-tabbar">
      <AppGrid :apps="visibleApps" @open="onAppClick" />
    </main>

    <FloatBanner v-bind="config.floatBanner || {}" />
    <TabBar :items="config.tabbar" :active="activeTab" @change="onTabChange" />
    <AdPopup :popups="config.popups" />
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
import AdPopup from '../components/AdPopup.vue'

const props = defineProps({
  initialTab: { type: String, default: 'apps' },
})

const router = useRouter()
const route = useRoute()
const activeTab = ref(props.initialTab)
const activeCategory = ref('官方推荐')
const activeMode = ref('recommend')

const appByName = new Map(config.apps.map((a) => [a.name, a]))

const visibleApps = computed(() => {
  const catNames = config.categoryApps?.byCategory?.[activeCategory.value] || []
  let names = catNames

  if (activeMode.value === 'download') {
    const modeNames = config.categoryApps?.modes?.['热门下载'] || []
    if (modeNames.length) {
      const modeSet = new Set(modeNames)
      names = catNames.filter((n) => modeSet.has(n))
    }
  }

  return names
    .map((name) => appByName.get(name))
    .filter(Boolean)
})

function onAppClick(app) {
  const target = app.signUrl || app.url
  if (target?.startsWith('http')) {
    window.open(target, '_blank')
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
</style>
