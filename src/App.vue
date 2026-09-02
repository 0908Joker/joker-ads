<template>
  <div v-if="!siteConfig.ready" class="boot">加载中…</div>
  <div v-else class="app-shell">
    <router-view />
    <AdPopup v-if="!isWatching" :popups="siteConfig.config.popups" />
    <ToastHost />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteConfig } from './composables/useSiteConfig.js'
import AdPopup from './components/AdPopup.vue'
import ToastHost from './components/ToastHost.vue'

const siteConfig = useSiteConfig()
const route = useRoute()
const isWatching = computed(
  () => route.path.startsWith('/play/') || route.path.startsWith('/short'),
)
</script>

<style scoped>
.app-shell,
.boot {
  min-height: 100vh;
  background: var(--dw-bg);
}
.boot {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dw-muted);
  font-size: 14px;
  letter-spacing: 0.12em;
}
</style>
