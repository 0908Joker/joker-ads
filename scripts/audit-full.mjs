#!/usr/bin/env node
/**
 * 全量 1:1 审计：原站 vs 克隆站 + 全部 API 段 vs config
 * 输出 crawled/audit-report.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'audit-report.json')
const ORIGIN = 'https://fbi.xdx794.com/#/appcenter'
const CLONE = process.env.CLONE_URL || 'http://51-pc.com/#/appcenter'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross').forEach((el) => el.click?.())
      document.querySelectorAll('.van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(150)
  }
}

async function scrape(page, label) {
  await page.goto(label === 'origin' ? ORIGIN : CLONE, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2500)
  if (label === 'origin') await dismissPopups(page)

  return page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    const txt = (sel) => q(sel).map((el) => el.textContent?.trim()).filter(Boolean)
    const apps = q('.app-card').map((el) => {
      const name = el.querySelector('.app-card__name')?.textContent?.trim() || el.textContent?.trim()
      const img = el.querySelector('img')
      const src = img?.currentSrc || img?.src || ''
      return {
        name,
        icon: src.slice(0, 80),
        isGif: /^data:image\/gif|\.gif/i.test(src),
        isAnimated: /^data:image\/gif|\.gif/i.test(src),
      }
    })
    const grid = document.querySelector('.apps-grid')
    const card = document.querySelector('.app-card__cover')
    const popupEl = document.querySelector('.van-popup img, .popup-img, .popup-card img')
    const promoTag = document.querySelector('.promo-banner__tag')
    const promoText = document.querySelector('.promo-banner__text')
    const floatStrong = document.querySelector('.float-banner strong, .float-banner__text strong')
    const floatSpan = document.querySelector('.float-banner span, .float-banner__text span')

    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    }

    const tabbar = q('.tabbar-item, nav.tabbar button, .tabbar button').map((el) => ({
      label: el.querySelector('.tabbar-item__text')?.textContent?.trim() || el.textContent?.trim(),
      active: el.classList.contains('is-active') || el.classList.contains('active'),
    }))

    return {
      title: document.title,
      categories: txt('.hero__tab, .hero__tabs button, nav.hero__tabs button'),
      modes: txt('.mode-switch__item, .mode-switch button'),
      promo: { tag: promoTag?.textContent?.trim(), text: promoText?.textContent?.trim() },
      floatBanner: { title: floatStrong?.textContent?.trim(), subtitle: floatSpan?.textContent?.trim() },
      tabbar,
      apps: { count: apps.length, list: apps },
      gifIcons: apps.filter((a) => a.isGif).length,
      popupVisible: !!document.querySelector('.van-popup, .popup-overlay'),
      popupSrc: popupEl?.currentSrc || popupEl?.src || '',
      sizes: {
        grid: rect(grid),
        icon: rect(card),
        promo: rect(document.querySelector('.promo-banner')),
        float: rect(document.querySelector('.float-banner')),
        popup: rect(popupEl?.closest('.popup-wrap, .van-popup, .popup-card') || popupEl),
        tabbar: rect(document.querySelector('.tabbar')),
      },
    }
  })
}

function diffLists(a, b, key = (x) => x) {
  const sa = new Set(a.map(key))
  const sb = new Set(b.map(key))
  return {
    onlyOrigin: [...sa].filter((x) => !sb.has(x)),
    onlyClone: [...sb].filter((x) => !sa.has(x)),
    match: [...sa].filter((x) => sb.has(x)).length,
  }
}

function auditApiSections(api, config) {
  const sections = api.getAllAD || {}
  const wired = {
    popups: (config.popups || []).filter((p) => p.image).length,
    floatBanner: !!config.floatBanner?.title,
    promo: !!config.promo?.tag,
    apps: (config.apps || []).length,
  }

  const sectionAudit = Object.entries(sections).map(([name, items]) => {
    const list = Array.isArray(items) ? items : []
    const withUrl = list.filter((x) => x.orgUrl || x.url).length
    const withSign = list.filter((x) => x.url && /ad\/sign/.test(x.url)).length
    let wiredIn = 'none'
    if (name === 'gridPopAds' || name === 'actPopAds') wiredIn = 'popups'
    else if (name === 'floatAd' || name === 'navigationTopBannerAds') wiredIn = 'floatBanner'
    else if (name === 'categoryTop') wiredIn = 'promo'
    else if (list.some((x) => (config.apps || []).some((a) => a.name === x.name))) wiredIn = 'apps(partial)'
    return { name, count: list.length, withUrl, withSign, wiredIn }
  })

  const moduleFields = api.getAppModule?.data || {}
  const moduleAudit = {
    notice: !!moduleFields.notice,
    hotSearchWords: (moduleFields.hotSearchWords || []).length,
    categories: (moduleFields.categories || []).length,
    cooperation: !!moduleFields.cooperation,
    wiredInConfig: {
      categories: (config.categories || []).length,
      modes: (config.modes || []).length,
    },
  }

  return { sectionAudit, moduleAudit, wired }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

  const originPage = await ctx.newPage()
  await originPage.goto('https://fbi.xdx794.com/#/launch', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await originPage.waitForTimeout(4000)
  const origin = await scrape(originPage, 'origin')

  const clonePage = await ctx.newPage()
  const clone = await scrape(clonePage, 'clone')

  const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
  const local = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))

  const urlMap = new Map()
  const signMap = new Map()
  for (const list of Object.values(api.getAllAD || {})) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item.name) continue
      if (item.orgUrl) urlMap.set(item.name, item.orgUrl)
      if (item.url && /ad\/sign/.test(item.url)) signMap.set(item.name, item.url)
    }
  }

  const localApps = local.apps || []
  const appLinks = localApps.filter((a) => a.url || a.signUrl)

  const apiAudit = auditApiSections(api, local)

  const report = {
    at: new Date().toISOString(),
    origin: {
      url: ORIGIN,
      title: origin.title,
      apps: { count: origin.apps.count, gifIcons: origin.gifIcons },
      appNames: origin.apps.list.map((a) => a.name),
      categories: origin.categories,
      modes: origin.modes,
      promo: origin.promo,
      floatBanner: origin.floatBanner,
      tabbar: origin.tabbar,
      sizes: origin.sizes,
    },
    clone: {
      url: CLONE,
      title: clone.title,
      apps: { count: clone.apps.count, gifIcons: clone.gifIcons },
      appNames: clone.apps.list.map((a) => a.name),
      categories: clone.categories.length ? clone.categories : local.categories,
      promo: clone.promo,
      floatBanner: clone.floatBanner,
      tabbar: clone.tabbar.length ? clone.tabbar : (local.tabbar || []).map((t) => ({ label: t.label })),
      sizes: clone.sizes,
    },
    diff: {
      appNames: diffLists(origin.apps.list, clone.apps.list, (a) => a.name),
      categories: diffLists(origin.categories, local.categories || []),
      tabbar: diffLists(origin.tabbar.map((t) => t.label), (local.tabbar || []).map((t) => t.label)),
      promo: {
        origin: origin.promo,
        clone: clone.promo?.tag ? clone.promo : local.promo,
      },
      floatBanner: {
        origin: origin.floatBanner,
        clone: clone.floatBanner?.title ? clone.floatBanner : local.floatBanner,
      },
      sizes: { origin: origin.sizes, clone: clone.sizes },
    },
    api: apiAudit,
    links: {
      localApps: localApps.length,
      withUrl: localApps.filter((a) => a.url).length,
      withSign: localApps.filter((a) => a.signUrl).length,
      withAnyLink: appLinks.length,
      apiUniqueNames: urlMap.size,
      sampleNoLink: localApps.filter((a) => !a.url && !a.signUrl).slice(0, 15).map((a) => a.name),
    },
    gaps: [],
  }

  if (origin.apps.count !== clone.apps.count) report.gaps.push(`app数量: 原站${origin.apps.count} vs 克隆${clone.apps.count}`)
  const nameDiff = report.diff.appNames.onlyOrigin.length + report.diff.appNames.onlyClone.length
  if (nameDiff) report.gaps.push(`app名称差异: 原站独有${report.diff.appNames.onlyOrigin.length}, 克隆独有${report.diff.appNames.onlyClone.length}`)

  if (report.links.withAnyLink < localApps.length * 0.9) {
    report.gaps.push(`链接覆盖率: ${report.links.withAnyLink}/${localApps.length} (API仅${urlMap.size}个唯一名)`)
  }

  const unwiredSections = apiAudit.sectionAudit.filter((s) => s.count > 0 && s.wiredIn === 'none')
  if (unwiredSections.length) {
    report.gaps.push(`未接入 API 段(${unwiredSections.length}): ${unwiredSections.slice(0, 8).map((s) => s.name).join(', ')}...`)
  }

  if ((local.tabbar || []).length >= 7 && !local.categoryApps) {
    report.gaps.push('TabBar 其他页面内容为占位（非原站完整页）')
  }

  if (!local.categoryApps?.byCategory) report.gaps.push('分类 Tab 数据未接入 config.categoryApps')
  else report.gaps.push('分类/模式筛选已接入（需部署后验证）')

  const iconSizeDiff = Math.abs((origin.sizes.icon?.w || 0) - (clone.sizes.icon?.w || 0))
  if (iconSizeDiff > 2) report.gaps.push(`图标尺寸差: 原${origin.sizes.icon?.w}px vs 克隆${clone.sizes.icon?.w}px`)

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log('=== 全量审计摘要 ===')
  console.log(`原站 apps: ${origin.apps.count}, GIF: ${origin.gifIcons}`)
  console.log(`克隆 apps: ${clone.apps.count}, GIF: ${clone.gifIcons}`)
  console.log(`链接 url/sign: ${report.links.withUrl}/${report.links.withSign}/${localApps.length}`)
  console.log(`API 段: ${apiAudit.sectionAudit.length}, 未接入: ${unwiredSections.length}`)
  console.log(`文案 promo: 原[${origin.promo?.tag}] vs 克隆[${clone.promo?.tag || local.promo?.tag}]`)
  console.log(`文案 float: 原[${origin.floatBanner?.title}] vs 克隆[${clone.floatBanner?.title || local.floatBanner?.title}]`)
  console.log('差距:')
  report.gaps.forEach((g) => console.log(`  - ${g}`))
  console.log(`\n完整报告: ${OUT}`)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
