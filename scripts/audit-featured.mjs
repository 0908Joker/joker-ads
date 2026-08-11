#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'audit-featured-live.json')
const ORIGIN = 'https://fbi.xdx794.com/#/videosPage'
const CLONE = 'http://51-pc.com/#/videosPage'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function scrapeFeatured(page, label) {
  const url = label === 'origin' ? ORIGIN : CLONE
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  if (label === 'origin') await dismissPopups(page)
  else {
    const close = page.locator('button[aria-label="关闭"]')
    if (await close.count()) await close.first().click().catch(() => {})
  }
  await page.waitForTimeout(1000)

  const data = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    const text = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
        color: cs.color,
        bg: cs.backgroundColor,
        fontSize: cs.fontSize,
      }
    }

    const bodyText = document.body.innerText
    const searchTags = q('.tags-scroll span, .top-search span').slice(0, 8).map(text).filter(Boolean)
    const catTabEls = q('.cat-tab, .van-tab, .van-tabs__nav .van-tab')
    const catTabs = catTabEls.slice(0, 20).map((el) => ({
      text: text(el),
      active: el.classList.contains('is-active') || el.classList.contains('van-tab--active'),
      ...rect(el),
    }))
    const chipEls = q('.chip, .filter-tag, [class*="chip"]')
    const chips = chipEls.slice(0, 20).map((el) => ({ text: text(el), ...rect(el) }))
    const subTabs = q('.sub-tab, [class*="sub-tab"]').map((el) => ({
      text: text(el),
      active: el.classList.contains('is-active'),
    }))
    const videoEls = q('.video-card, .video-item, .video-list article, .video-list > article')
    const videoCards = videoEls.slice(0, 15).map((el) => {
      const img = el.querySelector('img')
      const cover = el.querySelector('.cover, [class*="cover"]')
      return {
        title: text(el.querySelector('h3, h4, [class*="title"], .name') || el).slice(0, 80),
        meta: text(el.querySelector('p, [class*="meta"], [class*="info"]')),
        hasImg: !!img,
        imgSrc: (img?.src || '').slice(0, 120),
        coverIsGradient: cover ? getComputedStyle(cover).backgroundImage.includes('gradient') : false,
        coverRect: rect(cover || img),
        cardRect: rect(el),
      }
    })
    const adCard = q('.ad-card, [class*="ad-card"]').map((el) => ({ text: text(el).slice(0, 100), ...rect(el) }))
    const tabbar = q('.tabbar-item, .van-tabbar-item').map((el) => ({
      label: text(el.querySelector('.tabbar-item__text, .van-tabbar-item__text span, .van-tabbar-item__text')),
      active: el.classList.contains('is-active') || el.classList.contains('van-tabbar-item--active'),
      color: getComputedStyle(el).color,
    }))
    const catTabsEl = document.querySelector('.cat-tabs, .van-tabs')
    const tagsScrollEl = document.querySelector('.tags-scroll')

    return {
      hash: location.hash,
      title: document.title,
      searchTags,
      catTabs: catTabs.map(({ text: t, active }) => ({ text: t, active })),
      catTabTexts: catTabs.map((t) => t.text).filter(Boolean),
      chips: chips.map((c) => c.text).filter(Boolean),
      subTabs,
      videoCount: videoCards.length,
      videos: videoCards,
      adCard,
      tabbar,
      scrollInfo: {
        bodyScrollH: document.body.scrollHeight,
        winH: window.innerHeight,
        tagsOverflow: tagsScrollEl ? tagsScrollEl.scrollWidth > tagsScrollEl.clientWidth : null,
        catTabsOverflow: catTabsEl ? catTabsEl.scrollWidth > catTabsEl.clientWidth : null,
      },
      bodySample: bodyText.slice(0, 900).replace(/\s+/g, ' '),
      sizes: {
        tabbar: rect(document.querySelector('.tabbar, .van-tabbar')),
        catTabs: rect(document.querySelector('.cat-tabs, .van-tabs')),
        videoCard: videoCards[0]?.cardRect,
        cover: videoCards[0]?.coverRect,
        chip: rect(chipEls[0]),
      },
      colors: {
        activeCatTab: catTabs.find((t) => t.active)?.color,
        inactiveCatTab: catTabs.find((t) => !t.active)?.color,
        activeTabbar: tabbar.find((t) => t.active)?.color,
        inactiveTabbar: tabbar.find((t) => !t.active)?.color,
      },
    }
  })

  await page.screenshot({
    path: path.join(ROOT, 'scripts', label === 'origin' ? 'audit-featured-origin.png' : 'audit-featured-clone.png'),
    fullPage: false,
  })
  return data
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()

  const origin = await scrapeFeatured(page, 'origin')
  const clone = await scrapeFeatured(page, 'clone')

  const out = { at: new Date().toISOString(), origin, clone }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
}

main()
