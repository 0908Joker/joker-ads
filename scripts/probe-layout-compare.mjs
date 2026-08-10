#!/usr/bin/env node
import { chromium } from 'playwright'

const ORIGIN = 'https://fbi.xdx794.com'
const CLONE = 'http://51-pc.com'

async function measure(url, viewport, ua, label) {
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({ viewport, userAgent: ua })
  ).newPage()
  await page.goto(`${url}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  }
  if (!page.url().includes('appcenter')) {
    await page.goto(`${url}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
    await page.waitForTimeout(4000)
  }
  const data = await page.evaluate(() => {
    const card = document.querySelector('.app-card')
    const popup = document.querySelector('.van-popup, .van-popup--center')
    const tabbar = document.querySelector('.tabbar, .van-tabbar')
    return {
      path: location.hash,
      innerW: window.innerWidth,
      htmlFs: getComputedStyle(document.documentElement).fontSize,
      bodyW: document.body.clientWidth,
      iconW: card?.getBoundingClientRect()?.width ?? null,
      tabbarW: tabbar?.getBoundingClientRect()?.width ?? null,
      popupW: popup?.getBoundingClientRect()?.width ?? null,
      gridCols: card
        ? Math.round(document.body.clientWidth / card.getBoundingClientRect().width)
        : null,
    }
  })
  await page.screenshot({ path: `../crawled/layout-${label}.png`, fullPage: false })
  await browser.close()
  return { label, data }
}

const mobileUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const desktopUA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const vp = { width: 1440, height: 900 }

for (const [site, base] of [
  ['origin-m', ORIGIN],
  ['origin-d', ORIGIN],
  ['clone-m', CLONE],
  ['clone-d', CLONE],
]) {
  const ua = site.endsWith('-m') ? mobileUA : desktopUA
  const r = await measure(base, vp, ua, site)
  console.log(JSON.stringify(r))
}
