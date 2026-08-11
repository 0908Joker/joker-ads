#!/usr/bin/env node
/** P0: 修复 config — 弹窗 signUrl、缺失 app、internalRoutes、promo 链接 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/app-links-full.json'), 'utf8'))
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))

const signByName = new Map()
const urlByName = new Map()
for (const list of Object.values(api.getAllAD || {})) {
  if (!Array.isArray(list)) continue
  for (const item of list) {
    if (!item.name) continue
    if (item.orgUrl) urlByName.set(item.name, item.orgUrl)
    if (item.url && /ad\/sign/.test(item.url)) signByName.set(item.name, item.url)
  }
}
for (const a of links.apps || []) {
  if (a.url) urlByName.set(a.name, a.url)
  if (a.signUrl) signByName.set(a.name, a.signUrl)
}

// popups signUrl from gridPopAds + actPopAds
const popupAds = [...(api.getAllAD?.gridPopAds || []), ...(api.getAllAD?.actPopAds || [])]
for (const p of config.popups) {
  if (!p.image) continue
  const match = popupAds.find((a) => a.name === p.name) || popupAds.find((a) => p.name?.includes(a.name) || a.name?.includes(p.name))
  if (match) {
    if (match.url && /ad\/sign/.test(match.url)) p.signUrl = match.url
    if (match.orgUrl && !p.url) p.url = match.orgUrl
  }
}

// promo from categoryTop
const catTop = api.getAllAD?.categoryTop?.[0]
if (catTop) {
  config.promo = {
    tag: (catTop.remark?.match(/【([^】]+)】/) || [])[1] || '限时',
    text: catTop.remark?.replace(/【[^】]+】/, '').slice(0, 24) || config.promo?.text,
    signUrl: catTop.url && /ad\/sign/.test(catTop.url) ? catTop.url : '',
    url: catTop.orgUrl || '',
  }
}

// apps: merge links
for (const app of config.apps) {
  if (!app.url && urlByName.has(app.name)) app.url = urlByName.get(app.name)
  if (signByName.has(app.name)) app.signUrl = signByName.get(app.name)
}

// internal routes: only verified
config.internalRoutes = {
  超嫩少女: '/short',
  免费直播: '/videosPage',
  小红书: '/videosPage',
  推特: '/videosPage',
  AI引擎: '/vipPage',
  '51看片': '/videosPage',
}

// ensure 专业炮台 exists
if (!config.apps.some((a) => a.name === '专业炮台')) {
  config.apps.unshift({
    name: '专业炮台',
    url: urlByName.get('专业炮台') || '',
    signUrl: signByName.get('专业炮台') || '',
    icon: '/icons/placeholder.png',
  })
}

// ensure 免费黄片 — use 免费看黄片 data if same slot
const freeIdx = config.apps.findIndex((a) => a.name === '免费看黄片')
const huangPian = links.apps?.find((a) => a.name === '免费黄片')
if (!config.apps.some((a) => a.name === '免费黄片') && freeIdx >= 0) {
  const ref = config.apps[freeIdx]
  config.apps.splice(freeIdx, 0, {
    name: '免费黄片',
    url: huangPian?.url || ref.url,
    signUrl: huangPian?.signUrl || ref.signUrl,
    icon: ref.icon,
  })
}

config.synced = {
  ...(config.synced || {}),
  p0At: new Date().toISOString(),
  popupsWithSign: config.popups.filter((p) => p.signUrl).length,
  appsWithAnyLink: config.apps.filter((a) => a.url || a.signUrl).length,
  appsTotal: config.apps.length,
}

fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
console.log(`✅ P0 config: apps=${config.apps.length} links=${config.synced.appsWithAnyLink} popupSign=${config.synced.popupsWithSign}`)
