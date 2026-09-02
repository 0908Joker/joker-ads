#!/usr/bin/env node
/** Capture clone featured API response bodies for tab switches */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled/audit-featured-api-bodies.json')
const SITE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

const bodies = []
page.on('response', async (res) => {
  const u = res.url()
  if (!/api-proxy\/(categories|videos\/recommend|videos\/filter|tag\/videos|algoRecommend)/.test(u)) return
  let text = ''
  try { text = await res.text() } catch { return }
  let j = null
  try { j = JSON.parse(text) } catch {}
  const d = j?.data ?? j
  const vids = d?.videos || d?.list || d?.records || []
  const child = (d?.childCategories || []).flatMap((c) => c.videos || [])
  bodies.push({
    url: u.slice(0, 220),
    status: res.status(),
    err: j?.message || j?.errorCode || null,
    keys: d && typeof d === 'object' ? Object.keys(d).slice(0, 15) : typeof d,
    vidN: Array.isArray(vids) ? vids.length : 0,
    childN: child.length,
    first: (vids[0] || child[0])?.name || (vids[0] || child[0])?.title || null,
  })
})

await page.goto(`${SITE}/#/videosPage`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(5000)
await page.evaluate(() => {
  document.querySelectorAll('.popup-overlay, .van-overlay').forEach((el) => el.remove())
})

const structure = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    catTabs: [...document.querySelectorAll('.cat-tab')].map((e) => text(e)),
    chips: [...document.querySelectorAll('.chip')].map((e) => text(e)),
    subTabs: [...document.querySelectorAll('.sub-tab')].map((e) => ({
      t: text(e),
      active: e.classList.contains('is-active'),
    })),
    filterRow: text(document.querySelector('.filter-row')),
    more: text(document.querySelector('.more')),
    header: {
      tee: !!document.querySelector('.feat-head__tee'),
      search: !!document.querySelector('.feat-head__search, .search-bar'),
      searchPh: document.querySelector('input')?.placeholder || text(document.querySelector('.search-bar')),
      hist: text(document.querySelector('.feat-head__hist')),
      plus: text(document.querySelector('.feat-head__plus')),
    },
    grid: getComputedStyle(document.querySelector('.video-list')).gridTemplateColumns,
    adIdx: [...document.querySelectorAll('.video-row')].findIndex((el) => el.classList.contains('video-row--ad')),
    videoN: document.querySelectorAll('.video-row--video').length,
  }
})

// click a few non-recommend tabs and capture
for (const tab of ['最新', '探花', '日本', '推荐']) {
  await page.evaluate((t) => {
    ;[...document.querySelectorAll('.cat-tab')].find((e) => e.textContent.trim() === t)?.click()
  }, tab)
  await page.waitForTimeout(2500)
}

// sub tabs
for (const s of ['最新', '最热', '推荐']) {
  await page.evaluate((x) => {
    ;[...document.querySelectorAll('.sub-tab')].find((e) => e.textContent.trim() === x)?.click()
  }, s)
  await page.waitForTimeout(2200)
}

const titlesBySub = []
for (const s of ['推荐', '最新', '最热']) {
  await page.evaluate((x) => {
    ;[...document.querySelectorAll('.sub-tab')].find((e) => e.textContent.trim() === x)?.click()
  }, s)
  await page.waitForTimeout(2200)
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('.video-row--video h3')].map((e) => e.textContent.trim()).slice(0, 3),
  )
  titlesBySub.push({ s, titles })
}

// playback
await page.evaluate(() => document.querySelector('.video-row--tap')?.click())
await page.waitForTimeout(2500)
const playHash = await page.evaluate(() => location.hash)
const hasPlayer = await page.evaluate(() => !!document.querySelector('video, .player, [class*=player]'))

const report = {
  at: new Date().toISOString(),
  structure,
  titlesBySub,
  play: { hash: playHash, hasPlayer },
  bodies: bodies.slice(0, 40),
  summary: {
    catOkEmpty: bodies.filter((b) => /\/categories\//.test(b.url)).map((b) => ({
      url: b.url.match(/categories\/[^?]+/)?.[0],
      vidN: b.vidN,
      err: b.err,
      first: b.first?.slice?.(0, 40),
    })),
    recommend: bodies.filter((b) => /recommend/.test(b.url)).map((b) => ({
      vidN: b.vidN,
      err: b.err,
      first: b.first?.slice?.(0, 40),
    })),
  },
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  structure,
  titlesBySub,
  play: report.play,
  catResponses: report.summary.catOkEmpty.slice(0, 8),
  recommend: report.summary.recommend.slice(0, 3),
  bodyCount: bodies.length,
}, null, 2))
await browser.close()
