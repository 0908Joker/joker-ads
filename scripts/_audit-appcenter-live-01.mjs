#!/usr/bin/env node
/**
 * Agent 01 live App Center 1:1 audit — origin vs clone (b12sl5x.cn)
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'crawled', 'audit-4-appcenter-live.json')
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

async function dismissPopups(page) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll(
          'button[aria-label="关闭"], .van-popup__close-icon, .popup-close, .van-icon-cross, .ad-popup__close, .popup-wrap .close',
        )
        .forEach((el) => {
          try {
            el.click()
          } catch {}
        })
    })
    await page.waitForTimeout(150)
  }
}

async function scrape(url, label) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 120)))

  let ban = null
  page.on('response', async (res) => {
    try {
      if (res.url().includes('getAllAD') || res.status() === 403 || res.status() === 1067) {
        const t = await res.text().catch(() => '')
        if (/1067|IP|banned|封禁|限制/i.test(t) || res.status() === 1067) {
          ban = { status: res.status(), sample: t.slice(0, 200), url: res.url().slice(0, 120) }
        }
      }
    } catch {}
  })

  const nav = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => ({
    error: String(e),
  }))
  await page.waitForTimeout(4500)

  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '')
  const hash = await page.evaluate(() => location.hash)
  const title = await page.title()

  if (/1067|IP受限|访问受限|launch/i.test(bodyText) || hash.includes('launch')) {
    ban = ban || { status: 'page', sample: bodyText.slice(0, 200), hash, title }
  }

  // capture popup BEFORE dismiss
  const popup = await page.evaluate(() => {
    const wrap =
      document.querySelector('.popup-wrap, .ad-popup, .van-popup--center, .van-overlay + .van-popup') ||
      document.querySelector('.van-popup')
    const img = document.querySelector('.popup-img, .ad-popup img, .van-popup img, .popup-wrap img')
    const link = document.querySelector('.popup-card, .ad-popup a, .van-popup a')
    const r = wrap?.getBoundingClientRect()
    const visible = !!(wrap && r && r.width > 40 && r.height > 40)
    return {
      visible,
      imgSrc: (img?.src || '').slice(0, 120),
      imgFile: (img?.src || '').split('/').pop()?.slice(0, 50) || '',
      isGif: /\.gif/i.test(img?.src || ''),
      href: (link?.href || '').slice(0, 100),
      w: r ? Math.round(r.width) : 0,
      h: r ? Math.round(r.height) : 0,
    }
  })

  await dismissPopups(page)
  await page.waitForTimeout(800)

  const base = await page.evaluate(() => {
    const grid = document.querySelector('.apps-grid, .app-list, [class*="apps-grid"]')
    const cards = [...document.querySelectorAll('.app-card, .app-item, [class*="app-card"]')]
    const imgs = cards.map((c) => c.querySelector('img')).filter(Boolean)
    const meta = document.querySelector('.apps-meta')?.textContent?.trim()
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0
    const icon = document.querySelector('.app-card__cover, .app-item__icon, .cover-img')
    return {
      finalUrl: location.href,
      hash: location.hash,
      title: document.title,
      meta,
      apps: cards.length,
      names: cards.map((c) => (c.querySelector('.app-card__name, .app-name, span')?.textContent || c.textContent || '').trim()).filter(Boolean),
      cols,
      categories: [...document.querySelectorAll('.hero__tab, .hero__tabs button, .category-tab')].map((e) =>
        e.textContent.trim(),
      ),
      modes: [...document.querySelectorAll('.mode-switch__item, .mode-switch button')].map((e) =>
        e.textContent.replace(/\s+/g, ' ').trim(),
      ),
      promo: {
        exists: !!document.querySelector('.promo-banner, [class*="promo"]'),
        tag: document.querySelector('.promo-banner__tag')?.textContent?.trim() || '',
        text: document.querySelector('.promo-banner__text')?.textContent?.trim() || '',
        img: (document.querySelector('.promo-banner img')?.src || '').slice(0, 100),
        isGif: /\.gif/i.test(document.querySelector('.promo-banner img')?.src || ''),
        href: (document.querySelector('.promo-banner a')?.href || '').slice(0, 100),
      },
      float: {
        exists: !!document.querySelector('.float-banner, [class*="float-banner"]'),
        title:
          document.querySelector('.float-banner strong, .float-banner__title')?.textContent?.trim() || '',
        subtitle:
          document.querySelector('.float-banner span:not(strong), .float-banner__subtitle')?.textContent?.trim() ||
          '',
        btn: document.querySelector('.float-banner button, .float-banner__btn')?.textContent?.trim() || '',
      },
      gifCount: imgs.filter((i) => /\.gif|data:image\/gif/i.test(i.currentSrc || i.src || '')).length,
      pngCount: imgs.filter((i) => /\.png/i.test(i.currentSrc || i.src || '')).length,
      webpCount: imgs.filter((i) => /\.webp/i.test(i.currentSrc || i.src || '')).length,
      placeholderCount: imgs.filter((i) => /placeholder/i.test(i.currentSrc || i.src || '')).length,
      iconSize: icon
        ? {
            w: Math.round(icon.getBoundingClientRect().width),
            h: Math.round(icon.getBoundingClientRect().height),
          }
        : null,
      gridSize: grid
        ? {
            w: Math.round(grid.getBoundingClientRect().width),
            h: Math.round(grid.getBoundingClientRect().height),
          }
        : null,
      hasSmyp: cards.some((c) => (c.textContent || '').includes('上门约炮')),
    }
  })

  // category counts (all 7)
  const catCounts = {}
  const catNamesSample = {}
  for (const cat of base.categories) {
    await page.locator('.hero__tab, .hero__tabs button, .category-tab').filter({ hasText: cat }).first().click().catch(() => {})
    await page.waitForTimeout(500)
    const info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.app-card, .app-item')]
      return {
        count: cards.length,
        names: cards.slice(0, 12).map((c) => (c.querySelector('.app-card__name, span')?.textContent || '').trim()),
        hasSmyp: cards.some((c) => (c.textContent || '').includes('上门约炮')),
        meta: document.querySelector('.apps-meta')?.textContent?.trim() || '',
      }
    })
    catCounts[cat] = info.count
    catNamesSample[cat] = info
  }

  // modes on 官方推荐
  if (base.categories[0]) {
    await page.locator('.hero__tab, .hero__tabs button').filter({ hasText: base.categories[0] }).first().click().catch(() => {})
    await page.waitForTimeout(400)
  }

  await page.locator('.mode-switch__item, .mode-switch button').filter({ hasText: '热门下载' }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  const download = await page.evaluate(() => ({
    count: document.querySelectorAll('.app-card, .app-item').length,
    names: [...document.querySelectorAll('.app-card__name')].slice(0, 15).map((e) => e.textContent.trim()),
    meta: document.querySelector('.apps-meta')?.textContent?.trim() || '',
  }))

  await page.locator('.mode-switch__item, .mode-switch button').filter({ hasText: '站长推荐' }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  const recommend = await page.evaluate(() => ({
    count: document.querySelectorAll('.app-card, .app-item').length,
    names: [...document.querySelectorAll('.app-card__name')].slice(0, 15).map((e) => e.textContent.trim()),
    meta: document.querySelector('.apps-meta')?.textContent?.trim() || '',
  }))

  // click first app — capture popup/new page URL behavior
  let clickBehavior = null
  try {
    const [popupPage] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null),
      page.locator('.app-card, .app-item').first().click({ timeout: 3000 }),
    ])
    await page.waitForTimeout(800)
    if (popupPage) {
      clickBehavior = {
        type: 'new_tab',
        url: popupPage.url().slice(0, 160),
        isSign: /\/ad\/sign|sign\?s=/i.test(popupPage.url()),
      }
      await popupPage.close().catch(() => {})
    } else {
      clickBehavior = {
        type: 'same_tab_or_blocked',
        url: page.url().slice(0, 160),
        isSign: /\/ad\/sign|sign\?s=/i.test(page.url()),
      }
    }
  } catch (e) {
    clickBehavior = { type: 'error', error: String(e).slice(0, 120) }
  }

  // screenshot
  const shot = path.join(ROOT, 'crawled', `audit-4-${label}-appcenter.png`)
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {})

  await browser.close()
  return {
    label,
    url,
    navOk: !nav?.error,
    ban,
    bodySample: bodyText.slice(0, 180),
    title,
    hash,
    popup,
    ...base,
    catCounts,
    catNamesSample,
    download,
    recommend,
    clickBehavior,
    consoleErrors: consoleErrors.slice(0, 5),
    screenshot: shot,
  }
}

const origin = await scrape('https://fbi.xdx794.com/#/appcenter', 'origin')
const clone = await scrape('https://b12sl5x.cn/#/appcenter', 'clone')

const result = {
  at: new Date().toISOString(),
  origin,
  clone,
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
console.log(JSON.stringify({
  out: OUT,
  originBan: origin.ban,
  originApps: origin.apps,
  originCats: origin.categories,
  originModes: origin.modes,
  originCols: origin.cols,
  originGif: origin.gifCount,
  originRec: origin.recommend?.count,
  originDl: origin.download?.count,
  originCatCounts: origin.catCounts,
  originPopup: origin.popup,
  originClick: origin.clickBehavior,
  cloneApps: clone.apps,
  cloneCats: clone.categories,
  cloneModes: clone.modes,
  cloneCols: clone.cols,
  cloneGif: clone.gifCount,
  cloneRec: clone.recommend?.count,
  cloneDl: clone.download?.count,
  cloneCatCounts: clone.catCounts,
  clonePopup: clone.popup,
  cloneClick: clone.clickBehavior,
  cloneHasSmypDefault: clone.hasSmyp,
  clonePromo: clone.promo,
  cloneFloat: clone.float,
}, null, 2))
