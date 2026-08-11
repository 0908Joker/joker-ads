#!/usr/bin/env node
import { chromium } from 'playwright'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll('button[aria-label="关闭"], .van-popup__close-icon, .popup-close, .van-icon-cross')
        .forEach((el) => el.click?.())
    })
    await page.waitForTimeout(200)
  }
}

async function testSite(url, label) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await dismissPopups(page)

  const base = await page.evaluate(() => {
    const grid = document.querySelector('.apps-grid')
    const imgs = [...document.querySelectorAll('.cover-img--real, .app-card img')]
    return {
      apps: document.querySelectorAll('.app-card').length,
      cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      categories: [...document.querySelectorAll('.hero__tab, .hero__tabs button')].map((e) => e.textContent.trim()),
      modes: [...document.querySelectorAll('.mode-switch__item, .mode-switch button')].map((e) => e.textContent.trim()),
      promo: {
        tag: document.querySelector('.promo-banner__tag')?.textContent?.trim(),
        text: document.querySelector('.promo-banner__text')?.textContent?.trim(),
      },
      float: {
        title: document.querySelector('.float-banner strong, .float-banner__text strong')?.textContent?.trim(),
        subtitle: document.querySelector('.float-banner span, .float-banner__text span')?.textContent?.trim(),
      },
      tabbar: [...document.querySelectorAll('.tabbar-item, .tabbar button')].map((e) => ({
        label: e.querySelector('.tabbar-item__text')?.textContent?.trim() || e.textContent?.trim(),
        active: e.classList.contains('is-active') || e.classList.contains('active'),
      })),
      gifCount: imgs.filter((i) => /\.gif|data:image\/gif/i.test(i.src)).length,
      pngCount: imgs.filter((i) => /\.png/i.test(i.src)).length,
      iconSize: document.querySelector('.app-card__cover')?.getBoundingClientRect(),
    }
  })

  const catCounts = {}
  for (const cat of base.categories.slice(0, 4)) {
    await page.locator('.hero__tab, .hero__tabs button').filter({ hasText: cat }).first().click().catch(() => {})
    await page.waitForTimeout(600)
    catCounts[cat] = await page.evaluate(() => document.querySelectorAll('.app-card').length)
  }

  await page.locator('.mode-switch__item, .mode-switch button').filter({ hasText: '热门下载' }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  const downloadCount = await page.evaluate(() => document.querySelectorAll('.app-card').length)

  await page.locator('.mode-switch__item, .mode-switch button').filter({ hasText: '站长推荐' }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  const recommendCount = await page.evaluate(() => document.querySelectorAll('.app-card').length)

  // popup before dismiss
  const popupPage = await ctx.newPage()
  await popupPage.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await popupPage.waitForTimeout(2500)
  const popup = await popupPage.evaluate(() => {
    const wrap = document.querySelector('.popup-wrap, .van-popup')
    const img = document.querySelector('.popup-img, .van-popup img')
    const link = document.querySelector('.popup-card, .van-popup a')
    const r = wrap?.getBoundingClientRect()
    return {
      visible: !!wrap,
      img: img?.src?.split('/').pop()?.slice(0, 40),
      isGif: /\.gif/i.test(img?.src || ''),
      w: r ? Math.round(r.width) : 0,
      h: r ? Math.round(r.height) : 0,
      href: link?.href?.slice(0, 80),
    }
  })
  await popupPage.close()
  await browser.close()

  return { label, url, ...base, catCounts, downloadCount, recommendCount, popup }
}

const origin = await testSite('https://fbi.xdx794.com/#/appcenter', 'origin')
const clone = await testSite('http://51-pc.com/#/appcenter', 'clone')
console.log(JSON.stringify({ origin, clone }, null, 2))
