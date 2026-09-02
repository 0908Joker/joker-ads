#!/usr/bin/env node
/** FULL Featured 1:1 audit: origin vs clone */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled/audit-featured-full-02.json')
const ORIGIN = process.env.ORIGIN_URL || 'https://fbi.xdx794.com'
const CLONE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismiss(page) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll(
        '.van-popup__close-icon, .van-icon-cross, .van-overlay, .popup-overlay, [aria-label="关闭"], .close-btn',
      ).forEach((el) => {
        try { el.click?.() } catch {}
        try { el.remove?.() } catch {}
      })
    })
    await page.waitForTimeout(100)
  }
}

async function scrape(page, base, label) {
  const apiHits = []
  const onReq = (req) => {
    const u = req.url()
    if (/categories\/|videos\/recommend|videos\/filter|tag\/videos|algoRecommend/.test(u)) {
      apiHits.push(u.slice(0, 180))
    }
  }
  page.on('request', onReq)

  await page.goto(`${base}/#/videosPage`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(4500)
  await dismiss(page)
  await page.waitForTimeout(800)

  const structure = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const list = document.querySelector('.video-list, .van-list, [class*="video-list"]')
    const cs = list ? getComputedStyle(list) : null
    const cards = q('.video-row, .video-card, .video-item, .van-list .van-grid-item, article')
    const firstVideo = cards.find((el) => !el.classList.contains('video-row--ad') && !/广告|正在看/.test(text(el)))
    const ad = cards.find((el) => el.classList.contains('video-row--ad') || /广告|正在看|查看/.test(text(el)))
    const gridCols = cs?.gridTemplateColumns || ''
    const colCount = gridCols && gridCols !== 'none' ? gridCols.split(' ').filter(Boolean).length : null

    // header
    const search = document.querySelector('input[placeholder*="搜"], .search-bar, [class*="search"]')
    const headerIcons = q('header span, header button, .feat-head span, .feat-head button')
      .map((el) => text(el) || el.getAttribute('aria-label') || el.className)
      .filter(Boolean)
      .slice(0, 12)

    const catTabs = q('.cat-tab, .van-tabs__nav .van-tab, .category-tab').map((el) => ({
      text: text(el),
      active: el.classList.contains('is-active') || el.classList.contains('van-tab--active'),
    })).filter((t) => t.text)

    const chips = q('.chip, .filter-tag, .tags-scroll span, [class*="chip"]').map(text).filter(Boolean).slice(0, 20)
    const filterRow = text(document.querySelector('.filter-row, [class*="filter-row"]'))
    const subTabs = q('.sub-tab, [class*="sub-tab"]').map((el) => ({
      text: text(el),
      active: el.classList.contains('is-active'),
    })).filter((t) => t.text)
    const more = text(document.querySelector('.more, [class*="more"]'))

    const titles = q('.video-row--video h3, .video-card h3, article h3, .video-item .title')
      .map(text)
      .filter(Boolean)
      .slice(0, 8)

    const adIndex = cards.findIndex((el) => el.classList.contains('video-row--ad') || /广告|正在看/.test(text(el)))
    const adText = ad ? text(ad).slice(0, 80) : null

    // layout of first video card
    let layout = null
    if (firstVideo) {
      const r = firstVideo.getComputedStyle ? null : null
      const style = getComputedStyle(firstVideo)
      layout = {
        display: style.display,
        flexDir: style.flexDirection,
        w: Math.round(firstVideo.getBoundingClientRect().width),
        h: Math.round(firstVideo.getBoundingClientRect().height),
      }
    }

    return {
      hash: location.hash,
      hasSearch: !!search,
      searchPlaceholder: search?.getAttribute?.('placeholder') || search?.placeholder || text(search)?.slice(0, 40),
      headerIcons,
      catTabs,
      catTabTexts: catTabs.map((t) => t.text),
      activeCat: catTabs.find((t) => t.active)?.text || null,
      chips,
      filterRow,
      subTabs,
      more,
      videoCount: titles.length,
      titles,
      adIndex,
      adText,
      gridCols,
      colCount,
      listDisplay: cs?.display || null,
      cardLayout: layout,
      bodySample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
    }
  })

  // tab switch content check (first 6 cats)
  const perTab = []
  const tabs = structure.catTabTexts.slice(0, 8)
  for (const tab of tabs) {
    await page.evaluate((t) => {
      const btn = [...document.querySelectorAll('.cat-tab, .van-tabs__nav .van-tab, .category-tab')]
        .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === t)
      btn?.click()
    }, tab)
    await page.waitForTimeout(label === 'origin' ? 2800 : 2200)
    await dismiss(page)
    const info = await page.evaluate(() => {
      const titles = [...document.querySelectorAll('.video-row--video h3, .video-card h3, article h3, .video-item .title')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 5)
      return { titles, count: titles.length }
    })
    perTab.push({ name: tab, ...info })
  }

  // subTab switch on 推荐
  const subResults = []
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.cat-tab, .van-tabs__nav .van-tab')]
      .find((e) => /推荐/.test(e.textContent || ''))
    btn?.click()
  })
  await page.waitForTimeout(2000)
  for (const sub of ['推荐', '最新', '最热']) {
    await page.evaluate((s) => {
      const btn = [...document.querySelectorAll('.sub-tab, [class*="sub-tab"]')]
        .find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === s)
      btn?.click()
    }, sub)
    await page.waitForTimeout(2200)
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll('.video-row--video h3, .video-card h3, article h3')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 4),
    )
    subResults.push({ sub, first: titles[0] || null, titles })
  }

  // playback click
  let play = { ok: false, hash: null, error: null }
  try {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.cat-tab')].find((e) => /推荐/.test(e.textContent || ''))
      btn?.click()
    })
    await page.waitForTimeout(2000)
    const clicked = await page.evaluate(() => {
      const row = document.querySelector('.video-row--tap, .video-row--video, article.video-row, .video-card, article')
      if (!row) return false
      row.click()
      return true
    })
    await page.waitForTimeout(2500)
    play.hash = await page.evaluate(() => location.hash)
    play.ok = clicked && /play|video|detail|watch/i.test(play.hash || '')
    play.bodyHasPlayer = await page.evaluate(() =>
      !!(document.querySelector('video, .player, [class*="player"], .xgplayer, .dplayer')),
    )
  } catch (e) {
    play.error = String(e.message || e)
  }

  page.off('request', onReq)

  const titleSets = perTab.map((t) => t.titles.join('|'))
  const uniqueFeeds = new Set(titleSets.filter(Boolean)).size
  const subUnique = new Set(subResults.map((s) => s.titles.join('|')).filter(Boolean)).size

  return {
    label,
    base,
    structure,
    perTab,
    uniqueCatFeeds: uniqueFeeds,
    allCatSame: uniqueFeeds <= 1,
    subResults,
    uniqueSubFeeds: subUnique,
    play,
    apiHits: [...new Set(apiHits)].slice(0, 40),
    usesCategoriesApi: apiHits.some((u) => /\/categories\//.test(u)),
    usesRecommend: apiHits.some((u) => /videos\/recommend/.test(u)),
    usesFilter: apiHits.some((u) => /videos\/filter/.test(u)),
  }
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

let origin, clone
try {
  origin = await scrape(page, ORIGIN, 'origin')
} catch (e) {
  origin = { error: String(e.message || e) }
}
try {
  clone = await scrape(page, CLONE, 'clone')
} catch (e) {
  clone = { error: String(e.message || e) }
}

const oTabs = origin?.structure?.catTabTexts || []
const cTabs = clone?.structure?.catTabTexts || []
const oChips = origin?.structure?.chips || []
const cChips = clone?.structure?.chips || []
const oSubs = (origin?.structure?.subTabs || []).map((s) => s.text)
const cSubs = (clone?.structure?.subTabs || []).map((s) => s.text)

function arrMatch(a, b) {
  if (!a.length && !b.length) return { pct: 100, note: 'both empty' }
  const max = Math.max(a.length, b.length) || 1
  let same = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++
  return { pct: Math.round((same / max) * 100), same, max, aLen: a.length, bLen: b.length }
}

const checks = {
  catTabsOrder: arrMatch(oTabs, cTabs),
  chips: arrMatch(oChips, cChips),
  subTabs: arrMatch(oSubs, cSubs),
  grid2col: {
    origin: origin?.structure?.colCount,
    clone: clone?.structure?.colCount,
    ok: clone?.structure?.colCount === 2 || clone?.structure?.gridCols?.includes(' '),
  },
  adMidList: {
    originIdx: origin?.structure?.adIndex,
    cloneIdx: clone?.structure?.adIndex,
    ok: (clone?.structure?.adIndex ?? -1) >= 0,
  },
  searchBar: { origin: origin?.structure?.hasSearch, clone: clone?.structure?.hasSearch },
  tabSwitchDistinct: {
    originUnique: origin?.uniqueCatFeeds,
    cloneUnique: clone?.uniqueCatFeeds,
    cloneOk: (clone?.uniqueCatFeeds || 0) > 1,
  },
  subTabDistinct: {
    originUnique: origin?.uniqueSubFeeds,
    cloneUnique: clone?.uniqueSubFeeds,
  },
  playback: clone?.play,
  apis: {
    cloneUsesCategories: clone?.usesCategoriesApi,
    cloneUsesRecommend: clone?.usesRecommend,
    cloneUsesFilter: clone?.usesFilter,
  },
}

// score
const scoreParts = [
  checks.catTabsOrder.pct >= 80 ? 15 : checks.catTabsOrder.pct >= 50 ? 8 : 0,
  checks.chips.pct >= 50 ? 10 : checks.chips.aLen === 0 && checks.chips.bLen > 0 ? 6 : 0,
  checks.subTabs.pct >= 80 ? 10 : 0,
  checks.grid2col.ok ? 10 : 0,
  checks.adMidList.ok ? 10 : 0,
  checks.searchBar.clone ? 10 : 0,
  checks.tabSwitchDistinct.cloneOk ? 20 : 5,
  clone?.play?.ok ? 15 : 0,
]
const verdictPct = scoreParts.reduce((a, b) => a + b, 0)

const gaps = []
if (checks.catTabsOrder.pct < 100) gaps.push(`catTabs order/list mismatch ${checks.catTabsOrder.pct}% (o=${oTabs.length} c=${cTabs.length})`)
if (checks.chips.pct < 80) gaps.push(`chips mismatch o=${JSON.stringify(oChips.slice(0,5))} c=${JSON.stringify(cChips.slice(0,5))}`)
if (checks.subTabs.pct < 100) gaps.push(`subTabs mismatch o=${JSON.stringify(oSubs)} c=${JSON.stringify(cSubs)}`)
if (!checks.grid2col.ok) gaps.push(`grid not 2-col: clone colCount=${clone?.structure?.colCount} grid=${clone?.structure?.gridCols}`)
if (!checks.adMidList.ok) gaps.push('missing mid-list ad slot')
if (!checks.searchBar.clone) gaps.push('missing SearchBar')
if (!checks.tabSwitchDistinct.cloneOk) gaps.push('tab switch does NOT change content (same feed)')
if ((clone?.uniqueCatFeeds || 0) < (origin?.uniqueCatFeeds || 0)) gaps.push(`clone uniqueCatFeeds=${clone?.uniqueCatFeeds} < origin=${origin?.uniqueCatFeeds}`)
if (!clone?.play?.ok) gaps.push(`playback entry fail hash=${clone?.play?.hash}`)
if (!clone?.usesCategoriesApi) gaps.push('clone not hitting categories/{id}')

const report = {
  at: new Date().toISOString(),
  origin: ORIGIN,
  clone: CLONE,
  checks,
  verdictPct,
  gaps,
  originSummary: origin?.error || {
    tabs: oTabs,
    chips: oChips,
    subs: oSubs,
    uniqueCat: origin?.uniqueCatFeeds,
    uniqueSub: origin?.uniqueSubFeeds,
    adIdx: origin?.structure?.adIndex,
    colCount: origin?.structure?.colCount,
    play: origin?.play,
    apiSample: origin?.apiHits?.slice(0, 8),
  },
  cloneSummary: clone?.error || {
    tabs: cTabs,
    chips: cChips,
    subs: cSubs,
    perTab: clone?.perTab,
    subResults: clone?.subResults,
    uniqueCat: clone?.uniqueCatFeeds,
    uniqueSub: clone?.uniqueSubFeeds,
    adIdx: clone?.structure?.adIndex,
    adText: clone?.structure?.adText,
    colCount: clone?.structure?.colCount,
    headerIcons: clone?.structure?.headerIcons,
    search: clone?.structure?.searchPlaceholder,
    play: clone?.play,
    apiSample: clone?.apiHits?.slice(0, 12),
  },
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  verdictPct,
  gaps,
  tabSwitchDistinct: checks.tabSwitchDistinct,
  subTabDistinct: checks.subTabDistinct,
  playback: checks.playback,
  catTabs: checks.catTabsOrder,
  chips: checks.chips,
  grid2col: checks.grid2col,
  ad: checks.adMidList,
  cloneFirstTitles: (clone?.perTab || []).map((t) => ({ n: t.name, t: t.titles?.[0]?.slice(0, 28) })),
}, null, 2))

await browser.close()
process.exit(0)
