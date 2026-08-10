#!/usr/bin/env node
import { chromium } from 'playwright'

const SITE = 'https://fbi.xdx794.com'
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

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)

  const tabbarHtml = await page.evaluate(() => {
    const bar = document.querySelector('.tabbar, nav[class*="tabbar"]')
    return bar?.outerHTML?.slice(0, 2000)
  })
  console.log('tabbar', tabbarHtml)

  const labels = ['精选', '抖阴', '暗网', '圈子', '二次元', '我的']
  for (const label of labels) {
    await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1000)
    await dismissPopups(page)

    const clicked = await page.evaluate((text) => {
      const items = [...document.querySelectorAll('.tabbar-item, .tabbar button, .tabbar span, .tabbar div')]
      const el = items.find((x) => x.textContent?.includes(text))
      if (!el) return false
      ;(el.closest('.tabbar-item') || el.closest('button') || el).click()
      return true
    }, label)

    await page.waitForTimeout(3000)
    const info = await page.evaluate(() => ({
      hash: location.hash,
      path: location.pathname,
      cards: document.querySelectorAll('.video-card, .feed-item, .post-item, .circle-item, .comic-item, .app-card').length,
      sample: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
    }))
    console.log(label, 'clicked', clicked, info)
  }

  // extract routes from nuxt
  const routes = await page.evaluate(() => {
    const nuxt = window.$nuxt
    const r = nuxt?.$router?.options?.routes || nuxt?._router?.options?.routes || []
    return r.map((x) => ({ path: x.path, name: x.name, component: x.component?.name })).slice(0, 80)
  })
  console.log('routes', JSON.stringify(routes, null, 2))
  await browser.close()
}

main()
