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

async function testScroll(url, label) {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  if (label === 'origin') {
    await page.goto('https://fbi.xdx794.com/#/launch', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await dismissPopups(page)
  }
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  if (label === 'origin') await dismissPopups(page)
  else {
    const close = page.locator('button[aria-label="关闭"]')
    if (await close.count()) await close.first().click().catch(() => {})
  }

  const before = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    bodyH: document.body.scrollHeight,
    videoCount: document.querySelectorAll('.video-card, .imgBox, .twoItem').length,
  }))

  await page.evaluate(() => window.scrollTo(0, 2000))
  await page.waitForTimeout(800)
  const afterScroll = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollH: document.documentElement.scrollHeight,
    visibleVideos: [...document.querySelectorAll('.video-card, .imgBox, .twoItem')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.top < 844 && r.bottom > 0
    }).length,
  }))

  await browser.close()
  return { label, before, afterScroll }
}

const origin = await testScroll('https://fbi.xdx794.com/#/videosPage', 'origin')
const clone = await testScroll('http://51-pc.com/#/videosPage', 'clone')
console.log(JSON.stringify({ origin, clone }, null, 2))
