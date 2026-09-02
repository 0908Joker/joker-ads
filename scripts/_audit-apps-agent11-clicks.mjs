#!/usr/bin/env node
/** Agent 11: 30-click sample with aggressive popup dismiss */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLONE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const SAMPLE = 30

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))
const routes = cfg.internalRoutes || {}

function isLiveHttp(u) {
  if (!u || !String(u).trim()) return false
  const s = String(u).trim()
  if (s.startsWith('chrome-error:') || s.startsWith('about:')) return false
  return /^https?:\/\//i.test(s)
}

function expectedOf(name) {
  const a = cfg.apps.find((x) => x.name === name)
  if (!a) return { kind: 'missing', target: '' }
  if (isLiveHttp(a.signUrl)) return { kind: 'signUrl', target: a.signUrl }
  if (isLiveHttp(a.url)) return { kind: 'url', target: a.url }
  const ir = a.internalRoute || routes[name]
  if (ir) return { kind: 'internal', target: ir }
  return { kind: 'dead', target: '' }
}

async function dismissPopups(page) {
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll(
          'button[aria-label="关闭"], .van-popup__close-icon, .popup-close, .van-icon-cross, .ad-popup__close, .close-btn',
        )
        .forEach((el) => el.click?.())
      // remove blocking popup layers if close icons fail
      document.querySelectorAll('.popup-wrap, .van-overlay, .ad-popup').forEach((el) => {
        const style = getComputedStyle(el)
        if (style.position === 'fixed' || style.position === 'absolute') {
          el.style.display = 'none'
          el.remove()
        }
      })
      document.querySelectorAll('.popup-img').forEach((el) => {
        const wrap = el.closest('.popup-wrap, .van-popup, .ad-popup') || el.parentElement
        if (wrap) {
          wrap.style.display = 'none'
          wrap.remove()
        }
      })
    })
    const blocked = await page.evaluate(() => {
      const el = document.elementFromPoint(40, 220)
      return el?.classList?.contains('popup-img') || el?.closest?.('.popup-wrap, .van-popup, .ad-popup')
    })
    if (!blocked) break
    await page.waitForTimeout(200)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => {
    window.__opens = []
    window.open = function (url) {
      window.__opens.push(String(url || ''))
      return null
    }
  })
  const page = await ctx.newPage()
  await page.goto(`${CLONE}/#/appcenter`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(3500)
  await dismissPopups(page)

  const clearCheck = await page.evaluate(() => {
    const cards = document.querySelectorAll('.app-card')
    const first = cards[0]
    const r = first?.getBoundingClientRect()
    const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
    return {
      cards: cards.length,
      topTag: top?.tagName,
      topCls: (top?.className || '').toString().slice(0, 80),
    }
  })

  const cards = clearCheck.cards
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.app-card')].map(
      (c) => c.querySelector('.app-card__name')?.textContent?.trim() || '',
    ),
  )

  const indices = []
  for (let i = 0; i < Math.min(15, cards); i++) indices.push(i)
  const step = Math.max(1, Math.floor((cards - 15) / Math.max(1, SAMPLE - 15)))
  for (let i = 15; i < cards && indices.length < SAMPLE; i += step) indices.push(i)

  const results = []
  for (const idx of indices.slice(0, SAMPLE)) {
    const name = names[idx] || `idx-${idx}`
    const exp = expectedOf(name)
    await dismissPopups(page)
    await page.evaluate(() => {
      window.__opens = []
    })
    const before = await page.evaluate(() => location.hash)

    // Prefer DOM click to bypass residual overlays
    await page.evaluate((i) => {
      document.querySelectorAll('.app-card')[i]?.click()
    }, idx)
    await page.waitForTimeout(250)

    const opens = await page.evaluate(() => window.__opens || [])
    const after = await page.evaluate(() => location.hash)

    let kind = 'none'
    let opened = ''
    if (opens.length) {
      kind = 'popup'
      opened = opens[0]
    } else if (after !== before) {
      kind = 'internal'
      opened = after
      await page.goto(`${CLONE}/#/appcenter`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(500)
      await dismissPopups(page)
    }

    let host = ''
    try {
      host = opened.startsWith('http') ? new URL(opened).hostname : opened
    } catch {
      host = opened.slice(0, 40)
    }

    const match =
      exp.kind === 'dead'
        ? kind === 'none'
        : exp.kind === 'internal'
          ? kind === 'internal'
          : kind === 'popup' &&
            (opened === exp.target ||
              (exp.kind === 'signUrl' && opened.includes('/ad/sign')) ||
              (exp.kind === 'url' && opened === exp.target))

    results.push({
      idx,
      name,
      kind,
      openedHost: host,
      opened: opened.slice(0, 140),
      expectedKind: exp.kind,
      expectedHost: (() => {
        try {
          return exp.target.startsWith('http') ? new URL(exp.target).hostname : exp.target
        } catch {
          return ''
        }
      })(),
      match,
    })
  }

  await browser.close()

  const pass = results.filter((r) => r.match).length
  const out = {
    at: new Date().toISOString(),
    clone: CLONE,
    clearCheck,
    cardCount: cards,
    sampled: results.length,
    opened: results.filter((r) => r.kind !== 'none').length,
    pass,
    passPct: +((pass / results.length) * 100).toFixed(1),
    byKind: {
      popup: results.filter((r) => r.kind === 'popup').length,
      internal: results.filter((r) => r.kind === 'internal').length,
      none: results.filter((r) => r.kind === 'none').length,
    },
    signHostHits: [
      ...new Set(results.filter((r) => r.opened.includes('/ad/sign')).map((r) => r.openedHost)),
    ],
    urlHostsOpened: [
      ...new Set(
        results
          .filter((r) => r.kind === 'popup' && !r.opened.includes('/ad/sign'))
          .map((r) => r.openedHost),
      ),
    ],
    fails: results.filter((r) => !r.match),
    results,
  }

  fs.writeFileSync(path.join(ROOT, 'crawled', 'audit-11-click-sample.json'), JSON.stringify(out, null, 2))

  const mainPath = path.join(ROOT, 'crawled', 'audit-11-app-links.json')
  if (fs.existsSync(mainPath)) {
    const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'))
    main.cloneClickSample = {
      label: 'clone',
      base: CLONE,
      cardCount: cards,
      sampled: results.length,
      clearCheck,
      results,
      summary: {
        sampled: results.length,
        openedOrNavigated: out.opened,
        pass,
        passPct: out.passPct,
        byKind: out.byKind,
        signHostHits: out.signHostHits,
        fails: out.fails.map((f) => f.name),
        method: 'DOM .click() after popup remove + window.open hook',
      },
    }
    main.verdict.sampleClickPassPct = out.passPct
    main.verdict.clickOpened = out.opened
    fs.writeFileSync(mainPath, JSON.stringify(main, null, 2))
  }

  console.log(
    JSON.stringify(
      {
        clearCheck: out.clearCheck,
        sampled: out.sampled,
        opened: out.opened,
        pass: out.pass,
        passPct: out.passPct,
        byKind: out.byKind,
        signHostHits: out.signHostHits,
        urlHostsOpened: out.urlHostsOpened,
        fails: out.fails,
        sampleFirst6: results.slice(0, 6),
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
