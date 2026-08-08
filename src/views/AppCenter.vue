<template>
  <div class="application">
    <HeroHeader :categories="config.categories" :modes="config.modes" />
    <PromoBanner />

    <main class="content content--with-tabbar">
      <AppGrid :apps="config.apps" @open="onAppClick" />
    </main>

    <FloatBanner />
    <TabBar :items="config.tabbar" :active="activeTab" @change="activeTab = $event" />
    <AdPopup :popups="config.popups" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import config from '../data/config.json'
import HeroHeader from '../components/HeroHeader.vue'
import PromoBanner from '../components/PromoBanner.vue'
import AppGrid from '../components/AppGrid.vue'
import TabBar from '../components/TabBar.vue'
import FloatBanner from '../components/FloatBanner.vue'
import AdPopup from '../components/AdPopup.vue'

const activeTab = ref('apps')

function onAppClick(app) {
  if (app.url && app.url.startsWith('http')) {
    window.open(app.url, '_blank')
  }
}
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
  padding-bottom: calc(1.33333rem + env(safe-area-inset-bottom) + 1.2rem);
}
</style>
