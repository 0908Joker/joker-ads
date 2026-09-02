#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://fbi.xdx794.com'
const CLONE = 'https://b12sl5x.cn'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const TABS = ['抖阴', '福利姬', 'TikTok', 'AI', '动漫', '短剧']

async function dismiss(page) {
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll(
          'button[aria-label="关闭"], .van-popup__close-icon, .popup-close, .van-icon-cross, .ad-popup__close, .close-btn, .van-overlay',
        )
        .forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function probe(base, label) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const apis = []
  page.on('request', (r) => {
    const u = r.url()
    if (/\/videos\/short/i.test(u) || /shortAndImg/i.test(u) || /shortCate/i.test(u)) apis.push(u.slice(0, 240))
  })

  const gotoErr = await page
    .goto(`${base}/#/short`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    .then(() => null)
    .catch((e) => e.message)
  await page.waitForTimeout(7000)
  await dismiss(page)
  await page.waitForTimeout(2500)

  const shell = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    bodyLen: document.body.innerText.length,
    bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 450),
    allButtons: [...document.querySelectorAll('button, .van-tab, [role=tab]')]
      .map((b) => b.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 50),
    videoCount: document.querySelectorAll('video').length,
    canvas: document.querySelectorAll('canvas').length,
    iframes: document.querySelectorAll('iframe').length,
    scrollSnap: getComputedStyle(
      document.querySelector('.short-feed, .van-swipe, .swiper') || document.body,
    ).scrollSnapType,
  }))

  const perTab = {}
  for (const tab of TABS) {
    const clicked = await page.evaluate((name) => {
      const nodes = [...document.querySelectorAll('button, .van-tab, [role=tab], .tab, span, div')]
      const el = nodes.find((n) => (n.textContent || '').replace(/\s+/g, ' ').trim() === name)
      if (!el)
        return {
          ok: false,
          candidates: nodes
            .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 0 && t.length < 10)
            .slice(0, 40),
        }
      el.click()
      return { ok: true }
    }, tab)
    await page.waitForTimeout(4000)
    await dismiss(page)

    const data = await page.evaluate(async () => {
      const vids = [...document.querySelectorAll('video')]
      const slides = [...document.querySelectorAll('.short-slide, .van-swipe-item, .swiper-slide')]
      const users = [...document.querySelectorAll('.short-slide__user')].slice(0, 5).map((e) => e.textContent.trim())
      const titles = [...document.querySelectorAll('.short-slide__title')].slice(0, 5).map((e) => e.textContent.trim())
      const results = []
      for (let i = 0; i < Math.min(vids.length, 5); i++) {
        const v = vids[i]
        const row = {
          i,
          src: (v.currentSrc || v.src || '').slice(0, 120),
          muted: v.muted,
          paused: v.paused,
          rs: v.readyState,
          t: +v.currentTime.toFixed(2),
          err: v.error?.code || null,
        }
        try {
          v.muted = true
          await v.play()
          await new Promise((r) => setTimeout(r, 1000))
          row.after = {
            paused: v.paused,
            t: +v.currentTime.toFixed(2),
            rs: v.readyState,
            err: v.error?.code || null,
          }
          row.success = !v.paused && v.readyState >= 2 && v.currentTime > 0
        } catch (e) {
          row.playError = String(e.message || e)
          row.success = false
        }
        results.push(row)
      }
      return {
        slideCount: slides.length,
        videoCount: vids.length,
        users,
        titles,
        playSample: results,
        playOk: results.filter((r) => r.success).length,
        playN: results.length,
        dramaPanel: !!document.querySelector('.drama-panel'),
        dramaCards: document.querySelectorAll('.drama-card').length,
        hashtags: [...document.querySelectorAll('.hashtag')].map((e) => e.textContent.trim()),
        side: (document.querySelector('.short-slide__side, aside')?.innerText || '')
          .replace(/\s+/g, ' ')
          .slice(0, 140),
        videoFailedFlags: slides.filter((s) => s.querySelector('video') === null).length,
      }
    })
    perTab[tab] = { ...data, click: clicked }
  }

  await browser.close()
  return { label, base, gotoErr, shell, perTab, apiCount: apis.length, apis: [...new Set(apis)].slice(0, 20) }
}

function rate(site) {
  let ok = 0
  let n = 0
  for (const t of TABS) {
    ok += site.perTab[t].playOk || 0
    n += site.perTab[t].playN || 0
  }
  return { ok, n, pct: n ? +((ok / n) * 100).toFixed(1) : 0 }
}

const clone = await probe(CLONE, 'clone')
console.error('clone done', rate(clone))
const origin = await probe(ORIGIN, 'origin')
console.error('origin done', rate(origin))

const summary = {
  at: new Date().toISOString(),
  play: { origin: rate(origin), clone: rate(clone) },
  clone: {
    shell: clone.shell,
    apis: clone.apis,
    tabs: Object.fromEntries(
      TABS.map((t) => [
        t,
        {
          videos: clone.perTab[t].videoCount,
          slides: clone.perTab[t].slideCount,
          playOk: clone.perTab[t].playOk,
          playN: clone.perTab[t].playN,
          titles: clone.perTab[t].titles,
          users: clone.perTab[t].users,
          dramaPanel: clone.perTab[t].dramaPanel,
          dramaCards: clone.perTab[t].dramaCards,
          hashtags: clone.perTab[t].hashtags,
          side: clone.perTab[t].side,
          firstPlay: clone.perTab[t].playSample?.[0] || null,
        },
      ]),
    ),
  },
  origin: {
    gotoErr: origin.gotoErr,
    shell: origin.shell,
    apis: origin.apis,
    tabs: Object.fromEntries(
      TABS.map((t) => [
        t,
        {
          click: origin.perTab[t].click,
          videos: origin.perTab[t].videoCount,
          slides: origin.perTab[t].slideCount,
          playOk: origin.perTab[t].playOk,
          playN: origin.perTab[t].playN,
          titles: origin.perTab[t].titles,
          users: origin.perTab[t].users,
          dramaPanel: origin.perTab[t].dramaPanel,
          dramaCards: origin.perTab[t].dramaCards,
          side: origin.perTab[t].side,
          firstPlay: origin.perTab[t].playSample?.[0] || null,
        },
      ]),
    ),
  },
}

fs.writeFileSync(path.join(ROOT, 'crawled/audit-2-douyin-agent03-deep.json'), JSON.stringify({ summary, origin, clone }, null, 2))
console.log(JSON.stringify(summary, null, 2))
