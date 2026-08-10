#!/usr/bin/env node
/** 爬取 6 个 Tab 页 DOM 结构/文案/路由 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'tab-pages.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const TABS = [
  { id: 'featured', label: '精选', routes: ['#/featured', '#/home', '#/index', '#/recommend'] },
  { id: 'douyin', label: '抖阴', routes: ['#/douyin', '#/short', '#/tiktok'] },
  { id: 'dark', label: '暗网', routes: ['#/dark', '#/darkweb', '#/darknet'] },
  { id: 'circle', label: '圈子', routes: ['#/circle', '#/community', '#/sns'] },
  { id: 'anime', label: '二次元', routes: ['#/anime', '#/comic', '#/acg'] },
  { id: 'mine', label: '我的', routes: ['#/mine', '#/my', '#/user'] },
]

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function scrapePage(page) {
  return page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    return {
      title: document.title,
      hash: location.hash,
      headings: q('h1,h2,h3,.page-title,[class*="title"]').slice(0, 8).map((el) => el.textContent?.trim()).filter(Boolean),
      tabbar: q('.tabbar-item, .tabbar button').map((el) => ({
        label: el.textContent?.trim(),
        active: el.classList.contains('is-active') || el.classList.contains('active'),
      })),
      banners: q('[class*="banner"], [class*="swiper"]').slice(0, 3).map((el) => ({
        class: el.className?.slice?.(0, 60),
        text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100),
      })),
      cards: q('.video-card, .feed-item, .post-item, [class*="card"]').length,
      appCards: q('.app-card').length,
      imgs: q('img[src]').slice(0, 5).map((img) => (img.src || '').slice(0, 80)),
      bodyClass: document.body.className,
      mainHtml: document.querySelector('main, .page, #app > div > div')?.className || '',
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)

  const pages = {}

  // 先通过 tabbar 点击
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)

  for (const tab of TABS) {
    await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await dismissPopups(page)

    const btn = page.locator('.tabbar-item').filter({ hasText: tab.label }).first()
    if (await btn.count()) {
      await btn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(3000)
      await dismissPopups(page)
      const hash = await page.evaluate(() => location.hash)
      pages[tab.id] = { method: 'tabbar-click', hash, ...(await scrapePage(page)) }
      console.log(`${tab.label}: ${hash} cards=${pages[tab.id].cards} headings=${pages[tab.id].headings?.slice(0,2)}`)
      continue
    }

    for (const route of tab.routes) {
      await page.goto(`${SITE}/${route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
      await page.waitForTimeout(2000)
      const hash = await page.evaluate(() => location.hash)
      if (hash && hash !== '#/appcenter') {
        pages[tab.id] = { method: 'route', route, hash, ...(await scrapePage(page)) }
        console.log(`${tab.label} via ${route}: ${hash}`)
        break
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), pages }, null, 2))
  console.log(`✅ ${OUT}`)
  await browser.close()
}

main()
