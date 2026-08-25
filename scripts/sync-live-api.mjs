#!/usr/bin/env node
/** Snapshot decrypted live API payloads via origin page → src/data/live-api.json */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/data/live-api.json')
const CAT_OUT = path.join(ROOT, 'src/data/video-categories.json')
const SHORT_CAT_OUT = path.join(ROOT, 'src/data/short-categories.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const browser = await chromium.launch({ headless: true })
const page = await (
  await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
).newPage()

await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(5000)

const snap = await page.evaluate(async () => {
  const api = window.$nuxt?.$api
  if (!api) return { err: 'no api' }
  const out = {}
  const calls = [
    ['featured', () => api.getRecommendVideos?.({ page: 1, pageSize: 20 })],
    ['short', () => api.getShortVideos?.({ page: 1, pageSize: 10, categorieId: '6a706e1041270793030cdf54' })],
    ['shortCate', () => api.getShortCategorie?.()],
    ['appModule', () => api.getAppModule?.({ fields: '16,20,25,26,28,33,35,36,37,38,40,42,43,50,51,52,55,59,56' })],
    ['userInfo', () => api.getUserInfo?.()],
    ['actionStats', () => api.getActionStats?.()],
    ['homeComic', () => api.getHomeComic?.()],
  ]
  for (const [key, fn] of calls) {
    if (!fn()) continue
    try {
      const r = await fn()
      out[key] = r?.data ?? r
    } catch (e) {
      out[key] = { error: String(e) }
    }
  }
  return out
})

const payload = { at: new Date().toISOString(), ...snap }
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))

const moduleCats = snap.appModule?.categories || []
if (moduleCats.length) {
  fs.writeFileSync(
    CAT_OUT,
    JSON.stringify({
      at: new Date().toISOString(),
      categories: moduleCats.map((c) => ({ id: c.id, name: c.name, tags: c.tags || '' })),
    }, null, 2),
  )
}

const shortCats = snap.shortCate?.categories || []
if (shortCats.length) {
  fs.writeFileSync(
    SHORT_CAT_OUT,
    JSON.stringify({
      at: new Date().toISOString(),
      categories: shortCats.map((c) => ({ categorieId: c.categorieId, name: c.name })),
    }, null, 2),
  )
}

console.log('✅ live-api keys:', Object.keys(snap))
if (snap.featured?.videos) console.log('  featured videos:', snap.featured.videos.length)
if (snap.short?.videoInfo || snap.short?.videos) console.log('  short items:', (snap.short.videoInfo || snap.short.videos || []).length)
if (moduleCats.length) console.log('  video categories:', moduleCats.length)
if (shortCats.length) console.log('  short categories:', shortCats.length)
await browser.close()
