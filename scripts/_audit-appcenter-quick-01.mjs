#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'fs'

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

async function quick(url, label) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  const t0 = Date.now()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  } catch (e) {
    await browser.close()
    return { label, url, error: String(e).slice(0, 200), ms: Date.now() - t0 }
  }
  await page.waitForTimeout(4000)
  const body = await page.evaluate(() => (document.body?.innerText || '').slice(0, 500))
  const hash = await page.evaluate(() => location.hash)
  const ban =
    /1067|IP|受限|封禁/.test(body) || /launch/.test(hash)
      ? { hash, sample: body.slice(0, 220) }
      : null

  const popup = await page.evaluate(() => {
    const img = document.querySelector('.popup-wrap img, .ad-popup img, .van-popup img, .popup-img')
    const wrap = document.querySelector('.popup-wrap, .ad-popup, .van-popup')
    const r = wrap?.getBoundingClientRect()
    return {
      visible: !!(wrap && r && r.width > 40),
      isGif: /\.gif/i.test(img?.src || ''),
      src: (img?.src || '').slice(0, 120),
      href: (document.querySelector('.popup-wrap a, .ad-popup a, .van-popup a')?.href || '').slice(0, 120),
      w: Math.round(r?.width || 0),
      h: Math.round(r?.height || 0),
    }
  })

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape')
    await page.evaluate(() =>
      document
        .querySelectorAll('.van-popup__close-icon,.popup-close,.ad-popup__close,button[aria-label="关闭"]')
        .forEach((e) => e.click?.()),
    )
    await page.waitForTimeout(100)
  }

  const base = await page.evaluate(() => {
    const grid = document.querySelector('.apps-grid')
    const cards = [...document.querySelectorAll('.app-card')]
    const imgs = cards.map((c) => c.querySelector('img')).filter(Boolean)
    return {
      hash: location.hash,
      title: document.title,
      apps: cards.length,
      names: cards.map((c) => c.querySelector('.app-card__name')?.textContent?.trim() || '').filter(Boolean),
      cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0,
      cats: [...document.querySelectorAll('.hero__tab')].map((e) => e.textContent.trim()),
      modes: [...document.querySelectorAll('.mode-switch__item')].map((e) =>
        e.textContent.replace(/\s+/g, ' ').trim(),
      ),
      gif: imgs.filter((i) => /\.gif/i.test(i.src)).length,
      png: imgs.filter((i) => /\.png/i.test(i.src)).length,
      placeholder: imgs.filter((i) => /placeholder/i.test(i.src)).length,
      promo: {
        exists: !!document.querySelector('.promo-banner'),
        tag: document.querySelector('.promo-banner__tag')?.textContent?.trim() || '',
        text: document.querySelector('.promo-banner__text')?.textContent?.trim() || '',
        gif: /\.gif/i.test(document.querySelector('.promo-banner img')?.src || ''),
        href: (document.querySelector('.promo-banner a')?.href || '').slice(0, 100),
      },
      float: {
        exists: !!document.querySelector('.float-banner'),
        title: document.querySelector('.float-banner strong')?.textContent?.trim() || '',
        btn: document.querySelector('.float-banner button,.float-banner__btn')?.textContent?.trim() || '',
      },
      icon: (() => {
        const el = document.querySelector('.app-card__cover')
        const r = el?.getBoundingClientRect()
        return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null
      })(),
      meta: document.querySelector('.apps-meta')?.textContent?.trim() || '',
      hasSmyp: cards.some((c) => (c.textContent || '').includes('上门约炮')),
    }
  })

  const catCounts = {}
  const catHasSmyp = {}
  for (const cat of base.cats) {
    await page.locator('.hero__tab').filter({ hasText: cat }).first().click().catch(() => {})
    await page.waitForTimeout(400)
    const info = await page.evaluate(() => ({
      count: document.querySelectorAll('.app-card').length,
      hasSmyp: [...document.querySelectorAll('.app-card')].some((c) => (c.textContent || '').includes('上门约炮')),
      empty: document.querySelector('.apps-empty')?.textContent?.trim() || '',
    }))
    catCounts[cat] = info.count
    catHasSmyp[cat] = info.hasSmyp
  }

  if (base.cats[0]) {
    await page.locator('.hero__tab').filter({ hasText: base.cats[0] }).first().click()
    await page.waitForTimeout(300)
  }
  await page.locator('.mode-switch__item').filter({ hasText: '热门下载' }).first().click().catch(() => {})
  await page.waitForTimeout(450)
  const download = await page.evaluate(() => ({
    count: document.querySelectorAll('.app-card').length,
    meta: document.querySelector('.apps-meta')?.textContent?.trim() || '',
  }))
  await page.locator('.mode-switch__item').filter({ hasText: '站长推荐' }).first().click().catch(() => {})
  await page.waitForTimeout(450)
  const recommend = await page.evaluate(() => ({
    count: document.querySelectorAll('.app-card').length,
    meta: document.querySelector('.apps-meta')?.textContent?.trim() || '',
    names: [...document.querySelectorAll('.app-card__name')].slice(0, 25).map((e) => e.textContent.trim()),
  }))

  let click = null
  try {
    const [np] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 3500 }).catch(() => null),
      page.locator('.app-card').first().click({ timeout: 2500 }),
    ])
    if (np) {
      click = { type: 'new_tab', url: np.url().slice(0, 160), isSign: /sign/i.test(np.url()) }
      await np.close().catch(() => {})
    } else {
      click = { type: 'none', url: page.url().slice(0, 160) }
    }
  } catch (e) {
    click = { error: String(e).slice(0, 120) }
  }

  const shot = `crawled/audit-4-${label}-live-m390.png`
  await page.screenshot({ path: shot }).catch(() => {})
  await browser.close()
  return {
    label,
    url,
    ban,
    popup,
    ...base,
    catCounts,
    catHasSmyp,
    download,
    recommend,
    click,
    shot,
    ms: Date.now() - t0,
  }
}

console.log('scraping clone...')
const clone = await quick('https://b12sl5x.cn/#/appcenter', 'clone')
console.log('CLONE', clone.apps, clone.error || 'ok', clone.ms)

console.log('scraping origin...')
const origin = await quick('https://fbi.xdx794.com/#/appcenter', 'origin')
console.log('ORIGIN', origin.apps || origin.error, origin.ms)

const out = { at: new Date().toISOString(), origin, clone }
fs.writeFileSync('crawled/audit-4-appcenter-live.json', JSON.stringify(out, null, 2))
console.log(
  JSON.stringify(
    {
      originBan: origin.ban || origin.error || null,
      originApps: origin.apps,
      originCats: origin.cats,
      originModes: origin.modes,
      originCols: origin.cols,
      originGif: origin.gif,
      originRec: origin.recommend,
      originDl: origin.download,
      originCatCounts: origin.catCounts,
      originPopup: origin.popup,
      originClick: origin.click,
      cloneApps: clone.apps,
      cloneCats: clone.cats,
      cloneModes: clone.modes,
      cloneCols: clone.cols,
      cloneGif: clone.gif,
      cloneRec: clone.recommend,
      cloneDl: clone.download,
      cloneCatCounts: clone.catCounts,
      cloneCatHasSmyp: clone.catHasSmyp,
      clonePopup: clone.popup,
      cloneClick: clone.click,
      clonePromo: clone.promo,
      cloneFloat: clone.float,
      cloneHasSmyp: clone.hasSmyp,
    },
    null,
    2,
  ),
)
