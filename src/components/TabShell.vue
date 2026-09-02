<template>
  <div class="tab-shell">
    <slot />
    <TabBar :items="tabbar" :active="active" @change="onChange" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TabBar from './TabBar.vue'
import { useSiteConfig } from '../composables/useSiteConfig.js'
import tabsFallback from '../data/tabs.json'

defineProps({ active: { type: String, default: 'apps' } })

const router = useRouter()
const siteConfig = useSiteConfig()
const tabbar = computed(() => siteConfig.config.tabbar || [])
const routeMap = computed(() => {
  const live = siteConfig.tabs?.routes
  if (live && Object.keys(live).length) return live
  return tabsFallback.routes
})

function onChange(id) {
  const path = routeMap.value[id] || tabsFallback.routes?.[id] || '/appcenter'
  if (router.currentRoute.value.path !== path) router.push(path)
}
</script>

<style scoped>
.tab-shell {
  min-height: 100vh;
  padding-bottom: calc(var(--dw-tabbar-h) + env(safe-area-inset-bottom));
}
</style>
