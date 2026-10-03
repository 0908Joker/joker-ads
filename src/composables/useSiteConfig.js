import { reactive, readonly } from 'vue'
import { applyApiSession } from '../api/session.js'
import { fetchJsonTimed } from '../api/timedFetch.js'
export function emptySiteConfig() {
  return { config: { apps: [], categories: [], modes: [], categoryApps: {}, popups: [], promo: {}, floatBanner: {} },
    popups: { afterEnterApp: [], gridPopAds: [], actPopAds: [] },
    tabs: { mine: { quickApps: [] }, featured: { ad: {}, subTabs: [] } } }
}
export const siteConfig = reactive({ ready: false, error: '', ...emptySiteConfig(), version: 0 })
export async function loadSiteConfig() {
  siteConfig.ready = false
  siteConfig.error = ''
  try {
    const bundle = await fetchJsonTimed('/data/site-bundle.json?v=' + Date.now(), { cache: 'no-store' })
    if (!Array.isArray(bundle?.config?.apps) || !bundle.popups || !bundle.tabs || !Number.isSafeInteger(bundle.meta?.version)) throw new Error('站点配置无效')
    const empty = emptySiteConfig()
    siteConfig.config = { ...empty.config, ...bundle.config }
    siteConfig.popups = { ...empty.popups, ...bundle.popups }
    siteConfig.tabs = { ...empty.tabs, ...bundle.tabs,
      mine: { ...empty.tabs.mine, ...bundle.tabs.mine },
      featured: { ...empty.tabs.featured, ...bundle.tabs.featured } }
    siteConfig.version = bundle.meta.version
    if (bundle.apiSession?.token) applyApiSession(bundle.apiSession, 'runtime')
  } catch {
    Object.assign(siteConfig, emptySiteConfig())
    siteConfig.error = '配置加载失败，请重试'
  } finally { siteConfig.ready = true }
  return readonly(siteConfig)
}
export function useSiteConfig() { return siteConfig }
