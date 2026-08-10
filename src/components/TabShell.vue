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
import config from '../data/config.json'
import tabs from '../data/tabs.json'

defineProps({ active: { type: String, default: 'apps' } })

const router = useRouter()
const tabbar = config.tabbar

const routeMap = tabs.routes

function onChange(id) {
  const path = routeMap[id] || '/appcenter'
  if (router.currentRoute.value.path !== path) router.push(path)
}
</script>

<style scoped>
.tab-shell {
  min-height: 100vh;
  padding-bottom: calc(1.53846rem + env(safe-area-inset-bottom));
}
</style>
