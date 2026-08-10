#!/usr/bin/env node
/** 深度爬取 6 个 Tab 页 UI 数据 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'tab-pages-full.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const TABS = [
  { id: 'featured', label: '精选', hash: '#/videosPage' },
  { id: 'douyin', label: '抖阴', hash: '#/short' },
  { id: 'dark', label: '暗网', hash: '#/darkWeb/darkSecond' },
  { id: 'circle', label: '圈子', hash: '#/circle' },
  { id: 'anime', label: '二次元', hash: '#/vipPage' },
  { id: 'mine', label: '我的', hash: '#/my' },
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

async function scrape(page) {
  return page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    const text = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    }

    const tabs = q('.van-tab, .tab-item, [class*="tab-bar"] button, nav button').slice(0, 12).map(text)
    const tags = q('.tag, .filter-tag, [class*="tag"]').slice(0, 20).map(text).filter(Boolean)
    const videos = q('.video-item, .video-card, [class*="video-list"] > div, .short-item').slice(0, 8).map((el) => ({
      title: text(el.querySelector('[class*="title"], .name, h3, h4') || el).slice(0, 60),
      cover: (el.querySelector('img')?.src || '').slice(0, 80),
    }))
    const posts = q('.circle-item, .post-item, .feed-item, [class*="circle"] .item').slice(0, 8).map((el) => ({
      title: text(el).slice(0, 100),
      cover: (el.querySelector('img')?.src || '').slice(0, 80),
    }))
    const navItems = q('.van-tabbar-item').map((el) => ({
      label: text(el.querySelector('.van-tabbar-item__text span, .van-tabbar-item__text')),
      active: el.classList.contains('van-tabbar-item--active'),
    }))

    return {
      hash: location.hash,
      title: document.title,
      headerTabs: tabs,
      filterTags: tags,
      videos,
      posts,
      navItems,
      bodySample: document.body.innerText.slice(0, 500).replace(/\s+/g, ' '),
      sizes: {
        tabbar: rect(document.querySelector('.van-tabbar, .tabbar')),
        header: rect(document.querySelector('header, .header, .top-bar, .nav-bar')),
      },
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
  for (const tab of TABS) {
    await page.goto(`${SITE}/${tab.hash}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
    await page.waitForTimeout(3500)
    await dismissPopups(page)
    pages[tab.id] = { ...tab, ...(await scrape(page)) }
    console.log(`${tab.label}: ${pages[tab.id].hash} videos=${pages[tab.id].videos?.length} posts=${pages[tab.id].posts?.length}`)
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), pages }, null, 2))
  console.log(`✅ ${OUT}`)
  await browser.close()
}

main()
