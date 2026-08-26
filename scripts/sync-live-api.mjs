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
    ['shortCate', () => api.getShortCategorie?.()],
    ['appModule', () => api.getAppModule?.({ fields: '16,20,25,26,28,33,35,36,37,38,40,42,43,50,51,52,55,59,56' })],
    ['userInfo', () => api.getUserInfo?.()],
    ['actionStats', () => api.getActionStats?.()],
    ['homeComic', () => api.getHomeComic?.()],
    ['homeComicSuper', () => api.getHomeComic_super?.()],
    ['circleVoting', () => api.getAllCircleVoting?.({ page: 1, pageSize: 10 })],
    ['circleModule', () => api.moduleCHJ?.({ page: 1, pageSize: 10, type: 'basic', index: 0, compositeSort: 4 })],
  ]
  for (const [key, fn] of calls) {
    if (!fn()) continue
    try {
      const r = await fn()
      const data = r?.data ?? r
      if (data?.errorCode && data.errorCode !== 0) continue
      out[key] = data
    } catch (e) {
      out[key] = { error: String(e) }
    }
  }

  const shortCats = out.shortCate?.categories || out.shortCate || []
  if (Array.isArray(shortCats) && shortCats.length) {
    out.shortByTab = out.shortByTab || {}
    for (const c of shortCats) {
      const categorieId = c.categorieId || c.id
      if (!categorieId || !c.name) continue
      try {
        const r = await api.getShortVideos?.({ page: 1, pageSize: 10, categorieId })
        const data = r?.data ?? r
        if (data?.errorCode && data.errorCode !== 0) continue
        out.shortByTab[c.name] = data
      } catch (e) {
        out.shortByTab[c.name] = { error: String(e) }
      }
    }
    if (out.shortByTab['抖阴']) out.short = out.shortByTab['抖阴']
  }

  try {
    const r = await api.getShortAndImg?.({ page: 1, pageSize: 10, tab: '短剧' })
    const data = r?.data ?? r
    if (!data?.errorCode || data.errorCode === 0) {
      out.shortByTab = out.shortByTab || {}
      out.shortByTab['短剧'] = data
    }
  } catch (e) {
    out.shortByTab = out.shortByTab || {}
    out.shortByTab['短剧'] = { error: String(e) }
  }

  // Featured per-category via getSecondCategoriesData → categories/{id}
  const cats = out.appModule?.categories || []
  if (Array.isArray(cats) && cats.length && api.getSecondCategoriesData) {
    out.featuredByCat = {}
    for (const c of cats) {
      if (!c?.id || !c?.name) continue
      try {
        const r = await api.getSecondCategoriesData(c.id, {
          page: 1,
          pageSize: 20,
          timeType: 1,
          compositeSort: 1,
          inPool: true,
        })
        const data = r?.data ?? r
        if (data?.errorCode && data.errorCode !== 0) continue
        out.featuredByCat[c.name] = data
      } catch (e) {
        out.featuredByCat[c.name] = { error: String(e) }
      }
    }
  }

  return out
})

function isGoodSnapshot(val) {
  if (!val || typeof val !== 'object') return false
  if (val.error) return false
  if (val.errorCode && val.errorCode !== 0) return false
  return true
}

let existing = {}
try {
  existing = JSON.parse(fs.readFileSync(OUT, 'utf8'))
} catch {}

const payload = { ...existing, at: new Date().toISOString() }
for (const [key, val] of Object.entries(snap)) {
  if (key === 'shortByTab') continue
  if (isGoodSnapshot(val)) payload[key] = val
}
if (snap.shortByTab) {
  payload.shortByTab = { ...(existing.shortByTab || {}) }
  for (const [name, data] of Object.entries(snap.shortByTab)) {
    if (isGoodSnapshot(data)) payload.shortByTab[name] = data
  }
  if (payload.shortByTab['抖阴']) payload.short = payload.shortByTab['抖阴']
}
if (snap.featuredByCat) {
  payload.featuredByCat = { ...(existing.featuredByCat || {}) }
  for (const [name, data] of Object.entries(snap.featuredByCat)) {
    if (isGoodSnapshot(data)) payload.featuredByCat[name] = data
  }
}

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
if (snap.shortByTab) {
  for (const [name, data] of Object.entries(snap.shortByTab)) {
    const n = (data?.videoInfo || data?.videos || []).length
    if (n) console.log(`  short tab ${name}:`, n)
  }
}
if (moduleCats.length) console.log('  video categories:', moduleCats.length)
if (shortCats.length) console.log('  short categories:', shortCats.length)
await browser.close()
