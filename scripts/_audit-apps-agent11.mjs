#!/usr/bin/env node
/** Agent 11: app link coverage — config vs crawl + 30 clone click sample */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLONE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const ORIGIN = process.env.ORIGIN_URL || 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const SAMPLE = 30

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))
const linkAudit = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/link-audit-detail.json'), 'utf8'))

async function dismissPopups(page) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll(
          'button[aria-label="关闭"], .van-popup__close-icon, .popup-close, .van-icon-cross, .ad-popup__close',
        )
        .forEach((el) => el.click?.())
      document.querySelectorAll('.van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(180)
  }
}

function isLiveHttp(u) {
  if (!u || !String(u).trim()) return false
  const s = String(u).trim()
  if (s.startsWith('chrome-error:') || s.startsWith('about:') || s === '#') return false
  return /^https?:\/\//i.test(s)
}

function analyzeConfig() {
  const apps = cfg.apps || []
  const routes = cfg.internalRoutes || {}
  const hasUrl = (a) => isLiveHttp(a.url)
  const hasSign = (a) => isLiveHttp(a.signUrl)
  const hasInternal = (a) => !!(a.internalRoute || routes[a.name])
  const dead = apps.filter((a) => !hasUrl(a) && !hasSign(a) && !hasInternal(a))
  const withAny = apps.filter((a) => hasUrl(a) || hasSign(a) || hasInternal(a))
  const chromeErrorUrls = apps.filter((a) => String(a.url || '').startsWith('chrome-error:'))
  const signHosts = {}
  const urlHosts = {}
  for (const a of apps) {
    if (hasSign(a)) {
      try {
        const h = new URL(a.signUrl).hostname
        signHosts[h] = (signHosts[h] || 0) + 1
      } catch {}
    }
    if (hasUrl(a)) {
      try {
        const h = new URL(a.url).hostname
        urlHosts[h] = (urlHosts[h] || 0) + 1
      } catch {}
    }
  }
  return {
    total: apps.length,
    uniqueNames: new Set(apps.map((a) => a.name)).size,
    withUrl: apps.filter(hasUrl).length,
    withSign: apps.filter(hasSign).length,
    withInternal: apps.filter(hasInternal).length,
    withAnyAction: withAny.length,
    deadCount: dead.length,
    deadUnique: [...new Set(dead.map((a) => a.name))],
    deadEntries: dead.map((a) => a.name),
    chromeErrorPlaceholders: chromeErrorUrls.map((a) => a.name),
    coveragePct: +((withAny.length / apps.length) * 100).toFixed(1),
    signHosts,
    topUrlHosts: Object.entries(urlHosts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    internalRoutes: routes,
  }
}

async function sampleClicks(browser, base, label) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const results = []

  await page.goto(`${base}/#/appcenter`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => ({
    error: e.message,
  }))
  await page.waitForTimeout(3500)
  await dismissPopups(page)

  const cardCount = await page.locator('.app-card').count().catch(() => 0)
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.app-card')].map(
      (c) => c.querySelector('.app-card__name, .name, span')?.textContent?.trim() || c.textContent?.trim()?.slice(0, 20),
    ),
  )

  // Deterministic sample: first 15 + every Nth thereafter to reach SAMPLE
  const indices = []
  for (let i = 0; i < Math.min(15, cardCount); i++) indices.push(i)
  const step = Math.max(1, Math.floor((cardCount - 15) / Math.max(1, SAMPLE - 15)))
  for (let i = 15; i < cardCount && indices.length < SAMPLE; i += step) indices.push(i)
  while (indices.length < SAMPLE && indices.length < cardCount) {
    const n = indices.length
    if (!indices.includes(n)) indices.push(n)
    else break
  }

  for (const idx of indices.slice(0, SAMPLE)) {
    const name = names[idx] || `idx-${idx}`
    const popupPromise = page.waitForEvent('popup', { timeout: 4500 }).catch(() => null)
    const navPromise = page
      .waitForEvent('framenavigated', { timeout: 4500 })
      .then((f) => f.url())
      .catch(() => null)

    const beforeHash = await page.evaluate(() => location.hash)
    await page.locator('.app-card').nth(idx).click({ timeout: 4000 }).catch(() => null)
    const popup = await popupPromise
    const navUrl = await navPromise
    await page.waitForTimeout(400)

    let opened = null
    let kind = 'none'
    if (popup) {
      opened = popup.url()
      kind = 'popup'
      await popup.close().catch(() => {})
    } else {
      const afterHash = await page.evaluate(() => location.hash)
      if (afterHash !== beforeHash) {
        opened = afterHash
        kind = 'internal'
        await page.goto(`${base}/#/appcenter`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        await page.waitForTimeout(800)
        await dismissPopups(page)
      } else if (navUrl && !navUrl.includes('appcenter')) {
        opened = navUrl
        kind = 'navigate'
      }
    }

    // Classify expected from config
    const cfgApp = (cfg.apps || []).find((a) => a.name === name)
    const routes = cfg.internalRoutes || {}
    const expected =
      cfgApp?.signUrl || cfgApp?.url || cfgApp?.internalRoute || routes[name] || ''
    const expectedKind = cfgApp?.signUrl
      ? 'signUrl'
      : cfgApp?.url
        ? 'url'
        : routes[name] || cfgApp?.internalRoute
          ? 'internal'
          : 'dead'

    results.push({
      idx,
      name,
      kind,
      opened: (opened || '').slice(0, 120),
      expectedKind,
      expectedHost: expected.startsWith('http')
        ? (() => {
            try {
              return new URL(expected).hostname
            } catch {
              return ''
            }
          })()
        : expected || '',
      ok: kind !== 'none' || expectedKind === 'dead',
    })
  }

  await ctx.close()
  return { label, base, cardCount, sampled: results.length, results }
}

async function probeOriginCount(browser) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  let status = 'ok'
  try {
    const resp = await page.goto(`${ORIGIN}/#/appcenter`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    if (!resp || !resp.ok()) status = `http_${resp?.status()}`
  } catch (e) {
    status = e.message.slice(0, 80)
  }
  await page.waitForTimeout(3000)
  await dismissPopups(page)
  const cardCount = await page.locator('.app-card, .apps-grid > *').count().catch(() => 0)
  const title = await page.title().catch(() => '')
  const bodyHint = await page.evaluate(() => document.body?.innerText?.slice(0, 120) || '')
  await ctx.close()
  return { origin: ORIGIN, status, cardCount, title, bodyHint }
}

async function main() {
  const config = analyzeConfig()
  const browser = await chromium.launch({ headless: true })

  const [cloneSample, originProbe] = await Promise.all([
    sampleClicks(browser, CLONE, 'clone'),
    probeOriginCount(browser),
  ])

  await browser.close()

  const clickOk = cloneSample.results.filter((r) => r.kind !== 'none').length
  const clickDeadExpected = cloneSample.results.filter((r) => r.expectedKind === 'dead' && r.kind === 'none').length
  const clickFail = cloneSample.results.filter((r) => r.kind === 'none' && r.expectedKind !== 'dead')

  const report = {
    at: new Date().toISOString(),
    agent: '11/20 app-link-coverage',
    config,
    vsPriorLinkAudit: {
      priorTotalApps: linkAudit.counts?.totalApps,
      priorWithAnyLink: linkAudit.counts?.withAnyLink,
      priorNoAction: linkAudit.counts?.noActionAtAll,
      priorOriginAppCount: linkAudit.counts?.originAppCount,
      priorCloneAppCount: linkAudit.counts?.cloneAppCount,
      priorCoveragePct: linkAudit.alignment?.pctWithBehavior,
      priorUrlMismatches: linkAudit.urlMismatchCount,
      priorUrlMismatchNote: 'domain rotation — same channelCode/path, different host',
    },
    originLive: originProbe,
    cloneClickSample: {
      ...cloneSample,
      summary: {
        sampled: cloneSample.sampled,
        openedOrNavigated: clickOk,
        deadAsExpected: clickDeadExpected,
        unexpectedNoAction: clickFail.length,
        clickCoveragePct: +(((clickOk + clickDeadExpected) / cloneSample.sampled) * 100).toFixed(1),
        byKind: {
          popup: cloneSample.results.filter((r) => r.kind === 'popup').length,
          internal: cloneSample.results.filter((r) => r.kind === 'internal').length,
          navigate: cloneSample.results.filter((r) => r.kind === 'navigate').length,
          none: cloneSample.results.filter((r) => r.kind === 'none').length,
        },
        unexpectedNoActionNames: clickFail.map((r) => r.name),
      },
    },
    domainRotationNotes: {
      signApiHosts: config.signHosts,
      signApiNote:
        'All config.apps signUrl currently pin to a single ad-sign IP host (not rotating per click).',
      urlHostDiversity: config.topUrlHosts.length,
      priorMismatchExamples: (linkAudit.urlMismatches || []).slice(0, 8).map((m) => ({
        name: m.name,
        localHost: (() => {
          try {
            return new URL(m.local).hostname
          } catch {
            return m.local
          }
        })(),
        crawledHost: (() => {
          try {
            return new URL(m.crawled).hostname
          } catch {
            return m.crawled
          }
        })(),
        localUsesSign: m.localUsesSign,
      })),
      interpretation:
        'Origin CDN/landing hosts rotate over time; clone keeps last-synced url + durable signUrl. Click via signUrl is preferred and absorbs rotation. Static url host drift is expected, not a dead link.',
    },
    verdict: {
      configCoveragePct: config.coveragePct,
      deadAppsUnique: config.deadUnique,
      deadAppsCount: config.deadCount,
      sampleClickPassPct: +(((clickOk + clickDeadExpected) / cloneSample.sampled) * 100).toFixed(1),
    },
  }

  const out = path.join(ROOT, 'crawled', 'audit-11-app-links.json')
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.error('wrote', out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
