import { createRouter, createWebHashHistory } from 'vue-router'
import AppCenter from '../views/AppCenter.vue'
import FeaturedPage from '../views/FeaturedPage.vue'
import DouyinPage from '../views/DouyinPage.vue'
import MinePage from '../views/MinePage.vue'
import PlayPage from '../views/PlayPage.vue'
import RechargePage from '../views/RechargePage.vue'
import SearchPage from '../views/SearchPage.vue'
import BenefitsPage from '../views/BenefitsPage.vue'
import SharePage from '../views/SharePage.vue'
import DailyTaskPage from '../views/DailyTaskPage.vue'
import MessagePage from '../views/MessagePage.vue'

const routes = [
  { path: '/', redirect: '/appcenter' },
  { path: '/appcenter', name: 'appcenter', component: AppCenter },
  { path: '/videosPage', component: FeaturedPage },
  { path: '/short', component: DouyinPage },
  { path: '/my', component: MinePage },
  { path: '/play/:id', component: PlayPage },
  { path: '/play', redirect: '/videosPage' },
  { path: '/recharge', component: RechargePage },
  { path: '/recharge/vipRecharge', redirect: '/recharge?type=vip' },
  { path: '/searchPage', component: SearchPage },
  { path: '/myBenefits', component: BenefitsPage },
  { path: '/my/shareApp', component: SharePage },
  { path: '/activityPage/dailyCheckIn', component: DailyTaskPage },
  { path: '/message', component: MessagePage },
  // 兼容旧路由
  { path: '/featured', redirect: '/videosPage' },
  { path: '/douyin', redirect: '/short' },
  { path: '/mine', redirect: '/my' },
  // 暗网/圈子/二次元已下线，连同任何未知路径一起回首页，避免空白
  { path: '/:pathMatch(.*)*', redirect: '/appcenter' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
