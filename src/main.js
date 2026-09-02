import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pickApiBase } from './api/client.js'
import { loadSiteConfig } from './composables/useSiteConfig.js'
import './styles/global.css'

async function boot() {
  await Promise.all([pickApiBase().catch(() => {}), loadSiteConfig()])
  createApp(App).use(router).mount('#app')
}

boot()
