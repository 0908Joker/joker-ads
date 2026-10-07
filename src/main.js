import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pickApiBase } from './api/client.js'
import { loadSiteConfig, startSiteConfigSync } from './composables/useSiteConfig.js'
import { claimCustomer } from './composables/useCustomer.js'
import './styles/global.css'

async function boot() {
  createApp(App).use(router).mount('#app')
  void loadSiteConfig()
  startSiteConfigSync()
  void pickApiBase().catch(() => {})
  void claimCustomer().catch(() => {})
}

boot()
