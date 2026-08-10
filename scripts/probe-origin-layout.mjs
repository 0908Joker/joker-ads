#!/usr/bin/env node
import { chromium } from 'playwright'

const SITE = 'https://fbi.xdx794.com/#/appcenter'

async function probe(viewport, label) {
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({
      viewport,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    })
  ).newPage()
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)
  const data = await page.evaluate(() => {
    const app = document.querySelector('#app')
    const card = document.querySelector('.app-card')
    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      htmlFs: getComputedStyle(document.documentElement).fontSize,
      bodyW: document.body.clientWidth,
      appW: app?.clientWidth ?? null,
      appStyle: app
        ? {
            maxWidth: getComputedStyle(app).maxWidth,
            width: getComputedStyle(app).width,
            margin: getComputedStyle(app).margin,
            transform: getComputedStyle(app).transform,
          }
        : null,
      iconW: card?.getBoundingClientRect()?.width ?? null,
    }
  })
  await page.screenshot({ path: `../crawled/origin-layout-${label}.png` })
  await browser.close()
  return { label, viewport, data }
}

const viewports = [
  { w: 390, h: 844, label: 'mobile' },
  { w: 768, h: 1024, label: 'tablet' },
  { w: 1440, h: 900, label: 'desktop' },
]

for (const vp of viewports) {
  const r = await probe({ width: vp.w, height: vp.h }, vp.label)
  console.log(JSON.stringify(r))
}
