import { reactive, readonly } from 'vue'
import { applyApiSession } from '../api/session.js'
import { fetchJsonTimed } from '../api/timedFetch.js'
export function emptySiteConfig() {
  return { config: { apps: [], categories: [], modes: [], categoryApps: {}, popups: [], promo: {}, floatBanner: {} },
    popups: { afterEnterApp: [], gridPopAds: [], actPopAds: [] },
    tabs: { mine: { quickApps: [] }, featured: { ad: {}, subTabs: [] } } }
}
export const siteConfig = reactive({ ready: false, error: '', ...emptySiteConfig(), version: 0 })
let siteConfigFlight = null
let siteConfigLoaded = false
let siteSyncCleanup = null

export function applySiteConfig(bundle) {
  if (!Array.isArray(bundle?.config?.apps) || !bundle.popups || !bundle.tabs || !Number.isSafeInteger(bundle.meta?.version) || bundle.meta.version < 0) throw new Error('站点配置无效')
  if (siteConfigLoaded && bundle.meta.version <= siteConfig.version) return false
  const empty = emptySiteConfig()
  siteConfig.config = { ...empty.config, ...bundle.config }
  siteConfig.popups = { ...empty.popups, ...bundle.popups }
  siteConfig.tabs = { ...empty.tabs, ...bundle.tabs,
    mine: { ...empty.tabs.mine, ...bundle.tabs.mine },
    featured: { ...empty.tabs.featured, ...bundle.tabs.featured } }
  siteConfig.version = bundle.meta.version
  siteConfigLoaded = true
  if (bundle.apiSession?.token) applyApiSession(bundle.apiSession, 'runtime')
  return true
}

export function loadSiteConfig({ checkVersion = false } = {}) {
  if (siteConfigFlight) return siteConfigFlight
  // The initial false state owns the boot screen. Never reset it on retries:
  // even first-load failures must keep their error/retry UI visible.
  siteConfigFlight = (async () => {
    try {
      if (checkVersion && siteConfigLoaded) {
        const meta = await fetchJsonTimed('/data/meta.json?v=' + Date.now(), { cache: 'no-store' })
        if (!Number.isSafeInteger(meta?.version) || meta.version < 0) throw new Error('站点版本无效')
        if (meta.version <= siteConfig.version) { siteConfig.error = ''; return readonly(siteConfig) }
      }
      const bundle = await fetchJsonTimed('/data/site-bundle.json?v=' + Date.now(), { cache: 'no-store' })
      applySiteConfig(bundle)
      siteConfig.error = ''
    } catch {
      if (!siteConfigLoaded) Object.assign(siteConfig, emptySiteConfig())
      siteConfig.error = siteConfigLoaded ? '配置同步暂时失败，正在自动重试' : '配置加载失败，请重试'
    } finally { siteConfig.ready = true }
    return readonly(siteConfig)
  })().finally(() => { siteConfigFlight = null })
  return siteConfigFlight
}

export function startSiteConfigSync({ intervalMs = 5000 } = {}) {
  if (siteSyncCleanup) return siteSyncCleanup
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  let timer = null
  const refresh = () => { if (!document.hidden) void loadSiteConfig({ checkVersion: true }) }
  const pause = () => { if (timer !== null) clearInterval(timer); timer = null }
  const resume = () => {
    pause()
    if (document.hidden) return
    refresh()
    timer = setInterval(refresh, intervalMs)
  }
  const visibility = () => { if (document.hidden) pause(); else resume() }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('focus', refresh)
  window.addEventListener('online', refresh)
  window.addEventListener('pageshow', resume)
  window.addEventListener('pagehide', pause)
  siteSyncCleanup = () => {
    pause()
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('online', refresh)
    window.removeEventListener('pageshow', resume)
    window.removeEventListener('pagehide', pause)
    siteSyncCleanup = null
  }
  resume()
  return siteSyncCleanup
}
export function useSiteConfig() { return siteConfig }
