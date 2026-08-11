import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pickApiBase } from './api/client.js'
import './styles/global.css'

pickApiBase().catch(() => {})

createApp(App).use(router).mount('#app')
