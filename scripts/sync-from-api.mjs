#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/link-tree-full.json'), 'utf8'))
let clickLinks = { apps: [] }
try {
  clickLinks = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/app-links-full.json'), 'utf8'))
} catch {}
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))

const urlMap = new Map()
const signMap = new Map()

for (const list of Object.values(api.getAllAD || {})) {
  if (!Array.isArray(list)) continue
  for (const item of list) {
    if (!item.name) continue
    const u = item.orgUrl || item.url || ''
    if (u && !/ad\/sign/.test(u)) urlMap.set(item.name, u)
    if (item.url && /ad\/sign/.test(item.url)) signMap.set(item.name, item.url)
  }
}

for (const list of Object.values(links.sections || {})) {
  for (const item of list) {
    if (!item.name) continue
    if (item.url) urlMap.set(item.name, item.url)
    if (item.signUrl) signMap.set(item.name, item.signUrl)
  }
}

for (const item of clickLinks.apps || []) {
  if (!item.name) continue
  if (item.url && /^https?:\/\//.test(item.url)) urlMap.set(item.name, item.url)
  if (item.signUrl) signMap.set(item.name, item.signUrl)
}

let linked = 0
let signed = 0
for (const app of config.apps) {
  if (!app.url && urlMap.has(app.name)) {
    app.url = urlMap.get(app.name)
    linked++
  }
  const sign = signMap.get(app.name)
  if (sign) {
    app.signUrl = sign
    signed++
  }
}

const floatAd = api.getAllAD?.navigationTopBannerAds?.[0] || api.getAllAD?.floatAd?.[0]
config.floatBanner = {
  title: floatAd?.name || 'PG电子大放水',
  subtitle: floatAd?.remark?.replace(/<[^>]+>/g, '').slice(0, 24) || '投注爆千万',
  url: floatAd?.orgUrl || floatAd?.url || urlMap.get('PG电子') || '',
  signUrl: signMap.get('PG电子') || '',
  btn: '下载',
}

const catTop = api.getAllAD?.categoryTop?.[0]
config.promo = catTop?.remark
  ? {
      tag: (catTop.remark.match(/【([^】]+)】/) || [])[1] || '限时',
      text: catTop.remark.replace(/【[^】]+】/, '').slice(0, 24) || '聊天不限制',
    }
  : config.promo || { tag: '限时', text: '聊天不限制' }

config.synced = {
  at: new Date().toISOString(),
  urlsFromApi: urlMap.size,
  signUrls: signMap.size,
  linkedApps: config.apps.filter((a) => a.url).length,
  appsWithSign: signed,
  appsWithAnyLink: config.apps.filter((a) => a.url || a.signUrl).length,
}

try {
  const catApps = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/category-apps.json'), 'utf8'))
  config.categoryApps = { byCategory: catApps.byCategory, modes: catApps.modes }
} catch {}

fs.writeFileSync(path.join(ROOT, 'src/data/config.json'), JSON.stringify(config, null, 2))
console.log(`✅ 链接 ${config.synced.linkedApps}/${config.apps.length} | signUrl ${signed} | 任意链接 ${config.synced.appsWithAnyLink}`)
