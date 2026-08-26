#!/usr/bin/env node
/** P1-4: verify featured tabs load distinct lists via categories/{id} on clone */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled/audit-p1-featured-tabs.json')
const SITE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/video-categories.json'), 'utf8')).categories || []
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

const apiHits = []
page.on('request', (req) => {
  const u = req.url()
  if (/\/categories\//.test(u) || /\/videos\/recommend/.test(u) || /\/tag\/videos\/name/.test(u)) {
    apiHits.push(u.replace(/\?.*$/, '') + (u.includes('?') ? '?' + u.split('?')[1].slice(0, 120) : ''))
  }
})

await page.goto(`${SITE}/#/videosPage`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  document.querySelectorAll('.popup-overlay, .van-overlay').forEach((el) => el.remove())
})

const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('.cat-tab')].map((e) => e.textContent?.trim()).filter(Boolean),
)

const perTab = []
for (const tab of tabs.slice(0, 14)) {
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('.cat-tab')].find((e) => e.textContent?.trim() === t)
    btn?.click()
  }, tab)
  await page.waitForTimeout(2200)
  const info = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('.video-row--video h3')]
      .map((e) => e.textContent?.trim())
      .filter(Boolean)
      .slice(0, 5)
    return {
      videoCount: document.querySelectorAll('.video-row--video').length,
      titles,
    }
  })
  perTab.push({ name: tab, ...info })
}

const titleSets = perTab.map((t) => t.titles.join('|'))
const uniqueFeeds = new Set(titleSets.filter(Boolean)).size
const allSame = uniqueFeeds <= 1 && perTab.every((t) => t.videoCount > 0)

const report = {
  at: new Date().toISOString(),
  site: SITE,
  expectedCats: cats.map((c) => c.name),
  tabs,
  perTab,
  uniqueFeeds,
  allTabsSameContent: allSame,
  usesCategoriesApi: apiHits.some((u) => /\/categories\//.test(u)),
  apiHits: [...new Set(apiHits)].slice(0, 30),
  verdict: allSame ? 'FAIL_SAME_FEED' : uniqueFeeds > 1 ? 'PASS_DISTINCT' : 'INCONCLUSIVE',
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  tabs: tabs.length,
  uniqueFeeds,
  allSame,
  usesCategoriesApi: report.usesCategoriesApi,
  verdict: report.verdict,
  sample: perTab.slice(0, 3).map((t) => ({ name: t.name, n: t.videoCount, first: t.titles[0]?.slice(0, 30) })),
}, null, 2))

await browser.close()
process.exit(report.verdict === 'FAIL_SAME_FEED' ? 1 : 0)
