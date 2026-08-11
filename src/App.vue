<template>
  <div class="app-shell">
    <router-view />
    <AdPopup :popups="config.popups" />
  </div>
</template>

<script setup>
import config from './data/config.json'
import AdPopup from './components/AdPopup.vue'
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #111;
}
</style>
