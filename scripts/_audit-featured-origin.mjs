#!/usr/bin/env node
/** Origin featured structure scrape with launch warmup */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled/audit-featured-origin-02.json')
const ORIGIN = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismiss(page) {
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay, .van-popup').forEach((el) => {
        try { el.click?.() } catch {}
        try { el.remove?.() } catch {}
      })
    })
    await page.waitForTimeout(120)
  }
}

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
const apis = []
page.on('request', (req) => {
  const u = req.url()
  if (/categories|recommend|filter|algoRecommend|getSecond|tag\/videos|navs/.test(u)) apis.push(u.slice(0, 220))
})

await page.goto(`${ORIGIN}/#/launch`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(4000)
await dismiss(page)
await page.goto(`${ORIGIN}/#/videosPage`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(6000)
await dismiss(page)
await page.waitForTimeout(1500)

const info = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const body = document.body.innerText.replace(/\s+/g, ' ')
  // Extract known sections from body text
  const tabMatch = body.match(/最新\s+推荐\s+夏日限定[\s\S]*?同性/)
  const chipMatch = body.match(/💛AIGC[\s\S]*?约炮偷情/)
  const subMatch = body.match(/推荐\s+最新\s+最热/)
  const vanTabs = [...document.querySelectorAll('.van-tab')].map((e) => text(e)).filter((t) => t && t.length < 10)
  const hotTop = ['美女', '巨乳', '奶子', '帅哥'].filter((w) => body.includes(w))
  return {
    hash: location.hash,
    vanTabs,
    tabFromBody: tabMatch?.[0]?.replace(/\s+/g, ' ').slice(0, 120) || null,
    chipsFromBody: chipMatch?.[0]?.replace(/\s+/g, ' ') || null,
    hasQuickFilter: /快速筛选/.test(body),
    hasExpand: /展开/.test(body),
    hasSub: !!subMatch,
    hasMore: /最新影片\s*更多/.test(body),
    hotTop,
    hasAd: /广告|正在看|SQ直播/.test(body),
    bodySample: body.slice(0, 900),
  }
})

// try click 探花 vs 推荐 via van-tab
const perTab = []
for (const tab of ['推荐', '探花', '日本', '最新']) {
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('.van-tab')].find((e) => (e.textContent || '').trim() === t)
    btn?.click()
  }, tab)
  await page.waitForTimeout(3000)
  await dismiss(page)
  const titles = await page.evaluate(() => {
    const body = document.body.innerText
    // rough: lines that look like titles near durations
    return body.replace(/\s+/g, ' ').slice(200, 700)
  })
  perTab.push({ tab, sample: titles.slice(0, 200) })
}

const report = { at: new Date().toISOString(), info, perTab, apis: [...new Set(apis)].slice(0, 30) }
fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await page.screenshot({ path: path.join(ROOT, 'crawled/audit-featured-origin-02.png') })
await browser.close()
