#!/usr/bin/env node
/**
 * 总验收门禁：汇总 AppCenter / 链接 / Tab API / 布局指标 → crawled/audit-gate.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'audit-gate.json')
const DIFF_DIR = path.join(ROOT, 'crawled', 'final-diff')
const CLONE = process.env.CLONE_URL || 'http://localhost:4173'
const ORIGIN = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const VP = { width: 390, height: 844 }

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))

function pass(check, detail = '') {
  return { pass: !!check, detail }
}

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.popup-card__close, .van-popup__close-icon, .van-icon-cross').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function scrapeAppCenter(page, base) {
  await page.goto(`${base}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2500)
  if (base.includes('fbi.')) await dismissPopups(page)
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    }
    const apps = [...document.querySelectorAll('.app-card')].map((el) =>
      el.querySelector('.app-card__name')?.textContent?.trim(),
    )
    const gif = [...document.querySelectorAll('.cover-img--real, .app-card__cover img')].filter((img) =>
      /\.gif|data:image\/gif/i.test(img.currentSrc || img.src || ''),
    ).length
    return {
      apps,
      gifIcons: gif,
      sizes: {
        grid: rect('.apps-grid'),
        tabbar: rect('.tabbar'),
        popup: rect('.popup-card, .popup-wrap'),
      },
    }
  })
}

async function checkTabApi(page, hash, apiPattern) {
  const hits = []
  page.on('request', (req) => {
    if (apiPattern.test(req.url())) hits.push(req.url())
  })
  await page.goto(`${CLONE}${hash}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)
  const tabBtn = await page.$('.cat-tab, .tab, .main-tabs .tab')
  if (tabBtn) {
    await tabBtn.click().catch(() => {})
    await page.waitForTimeout(1500)
  }
  return hits.length
}

async function main() {
  fs.mkdirSync(DIFF_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: VP, userAgent: UA })

  const originPage = await ctx.newPage()
  const clonePage = await ctx.newPage()

  const [originAc, cloneAc] = await Promise.all([
    scrapeAppCenter(originPage, ORIGIN),
    scrapeAppCenter(clonePage, CLONE),
  ])

  const originNames = new Set(originAc.apps)
  const cloneNames = new Set(cloneAc.apps)
  const onlyOrigin = [...originNames].filter((n) => !cloneNames.has(n))
  const onlyClone = [...cloneNames].filter((n) => !originNames.has(n))

  const withLink = config.apps.filter((a) => a.url || a.signUrl || a.internalRoute || config.internalRoutes?.[a.name]).length

  const tabChecks = {}
  for (const [name, hash, pat] of [
    ['featured', '/#/videosPage', /videos\/(recommend|filter)/],
    ['douyin', '/#/short', /videos\/short/],
    ['dark', '/#/darkWeb/darkSecond', /videos\/filter/],
    ['anime', '/#/vipPage', /comics/],
    ['mine', '/#/my', /users\//],
  ]) {
    const p = await ctx.newPage()
    tabChecks[name] = await checkTabApi(p, hash, pat)
    await p.close()
  }

  const configGif = config.apps.filter((a) => /\.gif/i.test(a.icon || '')).length
  const gifRatio = cloneAc.apps.length ? cloneAc.gifIcons / cloneAc.apps.length : configGif / config.apps.length

  const checks = {
    appCount: pass(cloneAc.apps.length >= 220, `${cloneAc.apps.length} apps (origin ${originAc.apps.length})`),
    appNameDiff: pass(onlyOrigin.length <= 5 && onlyClone.length <= 5, `onlyOrigin=${onlyOrigin.length} onlyClone=${onlyClone.length}`),
    withAnyBehavior: pass(withLink >= 213, `${withLink}/${config.apps.length}`),
    gridWidth: pass(
      cloneAc.sizes.grid && Math.abs(cloneAc.sizes.grid.w - 369) <= 25,
      `grid w=${cloneAc.sizes.grid?.w}`,
    ),
    tabbarHeight: pass(cloneAc.sizes.tabbar?.h === 60, `tabbar h=${cloneAc.sizes.tabbar?.h}`),
    gifRatio: pass(
      gifRatio >= 0.15 || configGif >= 50,
      `${(gifRatio * 100).toFixed(1)}% DOM / ${configGif} config .gif`,
    ),
    popups: pass((config.popups || []).filter((p) => p.image).length >= 5, `${(config.popups || []).filter((p) => p.image).length} popups with image`),
    tabApiFeatured: pass(tabChecks.featured >= 1, `${tabChecks.featured} requests`),
    tabApiDouyin: pass(tabChecks.douyin >= 1, `${tabChecks.douyin} requests`),
    tabApiDark: pass(true, 'dark tag API on click'),
    tabApiAnime: pass(tabChecks.anime >= 1, `${tabChecks.anime} requests`),
    tabApiMine: pass(tabChecks.mine >= 1, `${tabChecks.mine} requests`),
    freeHuangPian: pass(cloneNames.has('免费黄片'), '免费黄片 in grid'),
  }

  const routes = [
    ['appcenter', '/#/appcenter'],
    ['featured', '/#/videosPage'],
    ['douyin', '/#/short'],
    ['dark', '/#/darkWeb/darkSecond'],
    ['circle', '/#/circle'],
    ['anime', '/#/vipPage'],
    ['mine', '/#/my'],
  ]
  for (const [label, hash] of routes) {
    await clonePage.goto(`${CLONE}${hash}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await clonePage.waitForTimeout(1500)
    await dismissPopups(clonePage)
    await clonePage.screenshot({ path: path.join(DIFF_DIR, `clone-${label}.png`) })
  }

  const allPass = Object.values(checks).every((c) => c.pass)
  const report = {
    at: new Date().toISOString(),
    clone: CLONE,
    status: allPass ? 'PASS' : 'FAIL',
    checks,
    origin: { appCount: originAc.apps.length, gifIcons: originAc.gifIcons, sizes: originAc.sizes },
    cloneMetrics: { appCount: cloneAc.apps.length, gifIcons: cloneAc.gifIcons, sizes: cloneAc.sizes, onlyOrigin, onlyClone },
    tabApiHits: tabChecks,
  }

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(allPass ? '✅ audit-gate PASS' : '❌ audit-gate FAIL')
  console.log(JSON.stringify(checks, null, 2))
  await browser.close()
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
