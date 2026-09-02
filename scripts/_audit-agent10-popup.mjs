#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLONE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const ORIGIN = process.env.ORIGIN_URL || 'https://fbi.xdx794.com'
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

async function dismissOne(page) {
  for (const sel of [
    '.popup-close',
    '.van-popup__close-icon',
    '.van-icon-cross',
    '[aria-label="关闭"]',
    'button.popup-close',
  ]) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
      await btn.click({ timeout: 1000 }).catch(() => {})
      await page.waitForTimeout(350)
      return true
    }
  }
  return false
}

async function measure(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        t: Math.round(r.top),
        l: Math.round(r.left),
      }
    }
    const overlay = q('.popup-overlay, .van-overlay')
    const popupImg = q(
      '.popup-img, .popup-card img, .van-popup img, .van-popup--center img',
    )
    const gridTitle = q('.grid-title')
    const gridAds = document.querySelectorAll(
      '.grid-ad, .grid-ads a, .grid-ads img',
    )
    const promoRoot = q('.promo-banner')
    const floatEl = q('.float-banner')
    const src = popupImg?.currentSrc || popupImg?.src || ''
    const isGif =
      /\.gif(\?|$)/i.test(src) ||
      src.startsWith('data:image/gif') ||
      /gif/i.test(src)

    let float = null
    if (floatEl) {
      float = {
        rect: rect(floatEl),
        text: floatEl.textContent?.trim()?.slice(0, 80),
        hasImg: !!floatEl.querySelector('img'),
        icon: floatEl.querySelector('.float-banner__icon')?.textContent,
      }
    } else {
      const candidates = [...document.querySelectorAll('div')].filter((d) => {
        const s = getComputedStyle(d)
        const b = d.getBoundingClientRect()
        return (
          s.position === 'fixed' &&
          parseFloat(s.bottom) < 120 &&
          b.height > 20 &&
          b.height < 90 &&
          b.width > 200
        )
      })
      const c = candidates[0]
      if (c) {
        float = {
          heuristic: true,
          rect: rect(c),
          text: c.textContent?.trim()?.slice(0, 80),
          hasImg: !!c.querySelector('img'),
        }
      }
    }

    let promo = null
    if (promoRoot) {
      const img = promoRoot.querySelector('img')
      promo = {
        rect: rect(promoRoot),
        src: (img?.currentSrc || img?.src || '').slice(0, 140),
        text: promoRoot.textContent?.trim()?.slice(0, 60),
      }
    }

    return {
      title: document.title,
      bodyHint: (document.body?.innerText || '')
        .slice(0, 100)
        .replace(/\s+/g, ' '),
      overlay: !!overlay,
      popupVisible: !!(
        popupImg ||
        gridTitle ||
        (overlay && getComputedStyle(overlay).display !== 'none')
      ),
      mode: gridTitle ? 'grid' : popupImg ? 'image' : 'none',
      gridTitle: gridTitle?.textContent?.trim() || null,
      gridAdCount: gridAds.length,
      popupSize: rect(
        popupImg?.closest(
          '.popup-wrap, .grid-wrap, .van-popup, .popup-card',
        ) || popupImg,
      ),
      imgSize: popupImg
        ? {
            w: popupImg.naturalWidth,
            h: popupImg.naturalHeight,
            display: rect(popupImg),
            src: src.slice(0, 140),
            isGif,
          }
        : null,
      promo,
      float,
      sessionDone: (() => {
        try {
          return sessionStorage.getItem('adPopupDone')
        } catch {
          return null
        }
      })(),
    }
  })
}

async function walkPopups(page, max = 12) {
  const steps = []
  for (let i = 0; i < max; i++) {
    await page.waitForTimeout(700)
    const m = await measure(page)
    if (!m.popupVisible && m.mode === 'none') {
      steps.push({ i, closed: true, mode: 'none' })
      break
    }
    steps.push({
      i,
      mode: m.mode,
      popupSize: m.popupSize,
      imgSize: m.imgSize,
      gridTitle: m.gridTitle,
      gridAdCount: m.gridAdCount,
      isGif: m.imgSize?.isGif || false,
    })
    const closed = await dismissOne(page)
    if (!closed) {
      const box = await page
        .locator('.popup-close, .van-popup__close-icon')
        .first()
        .boundingBox()
        .catch(() => null)
      if (box) {
        await page.mouse
          .click(box.x + box.width / 2, box.y + box.height / 2)
          .catch(() => {})
        await page.waitForTimeout(400)
      } else {
        steps[steps.length - 1].stuck = true
        break
      }
    }
  }
  await page.waitForTimeout(500)
  const after = await measure(page)
  return {
    steps,
    after,
    stepCount: steps.filter((s) => !s.closed).length,
  }
}

async function scrapeSite(browser, url, label) {
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  const mediaErrors = []
  page.on('response', (res) => {
    if (res.status() >= 400 && /ad|popup|geb|ceb|gif|promo|float/i.test(res.url())) {
      mediaErrors.push({ status: res.status(), url: res.url().slice(0, 140) })
    }
  })

  let navErr = null
  const resp = await page
    .goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    .catch((e) => {
      navErr = String(e.message || e)
      return null
    })
  await page.waitForTimeout(2800)

  const bodyText = await page.evaluate(
    () => document.body?.innerText?.slice(0, 240) || '',
  )
  if (/禁止登陆|禁止登录|此ip/i.test(bodyText)) {
    await context.close()
    return {
      label,
      url,
      blocked: true,
      bodyText,
      status: resp?.status(),
    }
  }

  const walk = await walkPopups(page)
  const base = url.replace(/#.*/, '')
  await page
    .goto(`${base}#/videosPage`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    .catch(() => {})
  await page.waitForTimeout(800)
  await page
    .goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    .catch(() => {})
  await page.waitForTimeout(1500)
  const remount = await measure(page)

  const shot = path.join(ROOT, 'crawled', `_agent10-${label}.png`)
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
  await context.close()

  return {
    label,
    url,
    status: resp?.status(),
    navErr,
    walk,
    remountPopup: remount.popupVisible,
    remountMode: remount.mode,
    remountSessionDone: remount.sessionDone,
    shot,
    mediaErrors: mediaErrors.slice(0, 10),
    bodyHint: bodyText.slice(0, 120),
  }
}

const browser = await chromium.launch({ headless: true })
const out = {
  at: new Date().toISOString(),
  clone: await scrapeSite(browser, `${CLONE}/#/appcenter`, 'clone'),
  origin: await scrapeSite(browser, `${ORIGIN}/#/appcenter`, 'origin'),
}
await browser.close()

const outPath = path.join(ROOT, 'crawled', '_agent10-popup-audit.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))

const summary = {
  cloneBlocked: !!out.clone.blocked,
  originBlocked: !!out.origin.blocked,
  cloneSteps: out.clone.walk?.stepCount,
  originSteps: out.origin.walk?.stepCount,
  cloneModes: out.clone.walk?.steps?.map((s) => s.mode),
  originModes: out.origin.walk?.steps?.map((s) => s.mode),
  cloneSizes: out.clone.walk?.steps?.map((s) => s.popupSize),
  originSizes: out.origin.walk?.steps?.map((s) => s.popupSize),
  cloneGif: out.clone.walk?.steps?.map((s) => s.isGif),
  originGif: out.origin.walk?.steps?.map((s) => s.isGif),
  cloneGrid: out.clone.walk?.steps
    ?.filter((s) => s.mode === 'grid')
    .map((s) => ({ title: s.gridTitle, n: s.gridAdCount })),
  originGrid: out.origin.walk?.steps
    ?.filter((s) => s.mode === 'grid')
    .map((s) => ({ title: s.gridTitle, n: s.gridAdCount })),
  cloneAfter: {
    promo: out.clone.walk?.after?.promo,
    float: out.clone.walk?.after?.float,
  },
  originAfter: {
    promo: out.origin.walk?.after?.promo,
    float: out.origin.walk?.after?.float,
  },
  cloneRemount: {
    popup: out.clone.remountPopup,
    done: out.clone.remountSessionDone,
  },
  originRemount: {
    popup: out.origin.remountPopup,
    done: out.origin.remountSessionDone,
  },
}
console.log(JSON.stringify(summary, null, 2))
console.log('wrote', outPath)
