#!/usr/bin/env node
import { chromium } from 'playwright'

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

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.goto('https://fbi.xdx794.com/#/launch', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(3000)
await dismissPopups(page)
await page.goto('https://fbi.xdx794.com/#/videosPage', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(4000)
await dismissPopups(page)

const data = await page.evaluate(() => {
  const q = (sel) => [...document.querySelectorAll(sel)]
  const text = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() || ''
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), color: cs.color, bg: cs.backgroundColor, fontSize: cs.fontSize }
  }

  const imgs = q('img').slice(0, 30).map((img) => ({
    src: img.src.slice(0, 100),
    nw: img.naturalWidth,
    nh: img.naturalHeight,
    w: img.width,
    h: img.height,
    parentCls: String(img.parentElement?.className || '').slice(0, 80),
  }))

  const videoLike = q('div, li, article').filter((el) => {
    const t = text(el)
    return /29:22|12:45|40:37|01:34:38/.test(t) && t.length < 200
  }).slice(0, 8).map((el) => ({
    cls: String(el.className).slice(0, 100),
    text: text(el),
    hasImg: !!el.querySelector('img'),
    img: el.querySelector('img')?.src?.slice(0, 100),
    rect: rect(el),
    coverRect: rect(el.querySelector('img, [class*="cover"], [class*="poster"]')),
  }))

  const vanTabs = q('.van-tab').map((el) => ({ text: text(el), active: el.classList.contains('van-tab--active'), rect: rect(el) }))
  const hotWords = ['美女', '巨乳', '奶子', '帅哥']
  const hotTags = q('*').filter((el) => hotWords.includes(text(el)) && el.children.length === 0).map((el) => ({
    tag: text(el),
    cls: String(el.className).slice(0, 60),
    rect: rect(el),
  }))

  const chips = q('*').filter((el) => /AIGC涩剧|巨乳翘臀|白虎嫩穴/.test(text(el)) && text(el).length < 30).map((el) => ({
    text: text(el),
    cls: String(el.className).slice(0, 60),
    rect: rect(el),
  }))

  const tabbar = q('.van-tabbar-item').map((el) => ({
    label: text(el.querySelector('.van-tabbar-item__text')),
    active: el.classList.contains('van-tabbar-item--active'),
    color: getComputedStyle(el).color,
    rect: rect(el),
  }))

  return {
    scrollH: document.body.scrollHeight,
    vanTabs,
    hotTags: hotTags.slice(0, 8),
    chips: chips.slice(0, 12),
    videoLike,
    imgs: imgs.filter((i) => i.nw > 50),
    tabbar,
    bodySample: document.body.innerText.slice(0, 1200).replace(/\s+/g, ' '),
  }
})

console.log(JSON.stringify(data, null, 2))
await browser.close()
