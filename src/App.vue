<template>
  <div class="app-shell">
    <router-view />
    <AdPopup v-if="!isWatching" :popups="config.popups" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import config from './data/config.json'
import AdPopup from './components/AdPopup.vue'

const route = useRoute()
// Popups are full-screen; on the player they would cover the video.
const isWatching = computed(() => route.path.startsWith('/play/'))
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #111;
}
</style>
