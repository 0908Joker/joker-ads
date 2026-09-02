import fallbackConfig from '../data/config.json'
import fallbackPopups from '../data/popups.json'
import fallbackTabs from '../data/tabs.json'
import { reactive, readonly } from 'vue'

export const siteConfig = reactive({
  ready: false,
  config: { ...fallbackConfig },
  popups: { ...fallbackPopups },
  tabs: { ...fallbackTabs },
  version: 1,
})

export async function loadSiteConfig() {
  const v = Date.now()
  const opts = { cache: 'no-store' }
  const results = await Promise.allSettled([
    fetch(`/data/config.json?v=${v}`, opts).then((r) => (r.ok ? r.json() : null)),
    fetch(`/data/popups.json?v=${v}`, opts).then((r) => (r.ok ? r.json() : null)),
    fetch(`/data/tabs.json?v=${v}`, opts).then((r) => (r.ok ? r.json() : null)),
    fetch(`/data/meta.json?v=${v}`, opts).then((r) => (r.ok ? r.json() : null)),
  ])
  const [cfg, pop, tabs, meta] = results.map((r) => (r.status === 'fulfilled' ? r.value : null))
  if (cfg) siteConfig.config = cfg
  if (pop) siteConfig.popups = pop
  if (tabs) siteConfig.tabs = tabs
  if (meta?.version) siteConfig.version = meta.version
  siteConfig.ready = true
  return readonly(siteConfig)
}

export function useSiteConfig() {
  return siteConfig
}
