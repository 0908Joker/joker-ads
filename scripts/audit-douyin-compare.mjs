#!/usr/bin/env node
import { chromium } from 'playwright'

const ORIGIN = 'https://fbi.xdx794.com/#/short'
const CLONE = 'http://51-pc.com/#/short'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay, button[aria-label="关闭"]')
        .forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function scrape(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await dismissPopups(page)
  return page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    const text = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() || ''
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }
    }

    const subTabs = q('.van-tab, .tab-item, nav.tabs button, nav button, .tabs .tab').map(text).filter(Boolean)
    const uniqueSubTabs = [...new Set(subTabs)]
    const cards = q(
      'video, .short-item, .video-item, .video-card, [class*="short"], [class*="video-list"] > div, article.short-card, .swiper-slide',
    ).slice(0, 8)
    const videoInfo = cards.map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: el.className?.toString().slice(0, 100),
      rect: rect(el),
      hasVideo: !!el.querySelector('video') || el.tagName === 'VIDEO',
      img: el.querySelector('img')?.src?.slice(0, 80),
      text: text(el).slice(0, 140),
    }))

    const actionLabels = ['分享', '打赏', '关闭', '客服']
    const actionBtns = q('button, span, div, a')
      .filter((el) => actionLabels.includes(text(el)))
      .slice(0, 24)
      .map((el) => ({ label: text(el), rect: rect(el), tag: el.tagName.toLowerCase(), cls: el.className?.toString().slice(0, 60) }))

    const tabbar = q('.tabbar-item, .van-tabbar-item, nav.tabbar button').map((el) => ({
      label: text(el.querySelector('.tabbar-item__text, .van-tabbar-item__text span, .van-tabbar-item__text') || el),
      active: el.classList.contains('is-active') || el.classList.contains('van-tabbar-item--active'),
      rect: rect(el),
    }))

    const rightActions = q('[class*="action"], [class*="side"], [class*="right"]').slice(0, 6).map((el) => ({
      cls: el.className?.toString().slice(0, 80),
      rect: rect(el),
      text: text(el).slice(0, 80),
    }))

    return {
      url: location.href,
      title: document.title,
      htmlFont: getComputedStyle(document.documentElement).fontSize,
      subTabs: uniqueSubTabs.slice(0, 12),
      bodyHead: document.body.innerText.slice(0, 400).replace(/\s+/g, ' '),
      cardCount: cards.length,
      videoInfo,
      actionBtns,
      rightActions,
      tabbar,
      sizes: {
        tabbar: rect(document.querySelector('.tabbar, .van-tabbar')),
        subTabNav: rect(document.querySelector('nav.tabs, .van-tabs__nav, .van-tabs')),
        feed: rect(document.querySelector('.feed, .short-list, section.feed, .swiper, .van-swipe')),
        firstCard: videoInfo[0]?.rect,
        viewport: { w: innerWidth, h: innerHeight },
      },
      hasRealVideo: q('video').length,
      videoSrcs: q('video').slice(0, 3).map((v) => (v.currentSrc || v.src || '').slice(0, 100)),
      imgs: q('img')
        .slice(0, 8)
        .map((i) => ({ src: (i.currentSrc || i.src || '').slice(0, 80), nw: i.naturalWidth, nh: i.naturalHeight })),
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const origin = await scrape(page, ORIGIN)
  const clone = await scrape(page, CLONE)
  await page.screenshot({ path: 'audit-douyin-clone.png', fullPage: false })
  await browser.close()
  console.log(JSON.stringify({ origin, clone }, null, 2))
}

main()
