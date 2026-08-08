import { createRouter, createWebHashHistory } from 'vue-router'
import AppCenter from '../views/AppCenter.vue'

const routes = [
  { path: '/', redirect: '/appcenter' },
  { path: '/appcenter', name: 'appcenter', component: AppCenter },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
