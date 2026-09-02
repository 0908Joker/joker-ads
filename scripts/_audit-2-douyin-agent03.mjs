#!/usr/bin/env node
/**
 * Agent 03 FULL 1:1:1 — Douyin /short audit (origin vs clone)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = process.env.ORIGIN_URL || 'https://fbi.xdx794.com'
const CLONE = process.env.CLONE_URL || 'https://b12sl5x.cn'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const EXPECTED_TABS = ['抖阴', '福利姬', 'TikTok', 'AI', '动漫', '短剧']
const OUT = path.join(ROOT, 'crawled', 'audit-2-douyin-agent03.json')

async function dismissPopups(page) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll(
          'button[aria-label="关闭"], .van-popup__close-icon, .popup-close, .van-icon-cross, .ad-popup__close, .close-btn',
        )
        .forEach((el) => el.click?.())
      document.querySelectorAll('.van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(150)
  }
}

async function scrapeSite(browser, base) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const apiCalls = []

  page.on('request', (req) => {
    const url = req.url()
    if (/\/videos\/short/i.test(url) || /\/videos\/shortAndImg/i.test(url) || /\/videos\/shortCate/i.test(url)) {
      apiCalls.push({ url: url.slice(0, 260), method: req.method() })
    }
  })

  await page.goto(`${base}/#/short`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => e.message)
  await page.waitForTimeout(4500)
  await dismissPopups(page)
  await page.waitForTimeout(800)

  const shell = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)]
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const tabs = [
      ...new Set(
        q('nav.tabs button, nav.tabs .tab, .van-tabs__nav .van-tab, .tabs .tab, [class*="sub-tab"]')
          .map(text)
          .filter(Boolean),
      ),
    ]
    const videos = q('video')
    const sideText = text(document.querySelector('.short-slide__side, [class*="side-act"], [class*="right-action"], [class*="action-bar"]'))
    const chromeLabels = ['分享', '打赏', '客服', '打开', '静音', '关闭']
    const chromeHits = chromeLabels.filter((lab) => document.body.innerText.includes(lab))
    const feed = document.querySelector('.short-feed, .van-swipe, .swiper, [class*="short-list"], [class*="feed"]')
    const feedStyle = feed ? getComputedStyle(feed) : null
    return {
      href: location.href,
      title: document.title,
      tabs,
      videoCount: videos.length,
      hasVideos: videos.length > 0,
      videoSrcs: videos.slice(0, 5).map((v) => (v.currentSrc || v.src || '').slice(0, 120)),
      mutedCount: videos.filter((v) => v.muted).length,
      autoplayCount: videos.filter((v) => v.autoplay).length,
      playingCount: videos.filter((v) => !v.paused && v.readyState >= 2).length,
      readyStates: videos.slice(0, 6).map((v) => v.readyState),
      currentTimes: videos.slice(0, 6).map((v) => +v.currentTime.toFixed(2)),
      sideText: sideText.slice(0, 200),
      chromeHits,
      scrollSnap: feedStyle?.scrollSnapType || null,
      feedOverflow: feedStyle?.overflowY || null,
      bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
      drama: {
        panelPresent: !!document.querySelector('.drama-panel, [class*="drama"]'),
        hashtagCount: q('.hashtag, .drama-panel .hashtag, [class*="hashtag"]').length,
        dramaCardCount: q('.drama-card, [class*="drama-card"], [class*="short-drama"]').length,
      },
    }
  })

  const perTab = {}
  for (const tabName of EXPECTED_TABS) {
    const beforeApis = apiCalls.length
    const clicked = await page.evaluate((name) => {
      const btns = [...document.querySelectorAll('nav.tabs button, nav.tabs .tab, .van-tab, .tabs .tab, button.tab')]
      const el = btns.find((b) => (b.textContent || '').replace(/\s+/g, ' ').trim() === name)
      if (!el) return false
      el.click()
      return true
    }, tabName)
    await page.waitForTimeout(2800)
    await dismissPopups(page)

    const data = await page.evaluate((tab) => {
      const q = (sel) => [...document.querySelectorAll(sel)]
      const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const videos = q('video')
      const slides = q('.short-slide, article.short-slide, .swiper-slide, .van-swipe-item, [class*="short-item"]')
      const titles = slides
        .slice(0, 5)
        .map((s) => {
          const t = s.querySelector('.short-slide__title, [class*="title"], .title, p')
          return text(t).slice(0, 60)
        })
        .filter(Boolean)
      const firstSrc = videos[0] ? videos[0].currentSrc || videos[0].src || '' : ''
      let playOk = false
      let playErr = null
      if (videos[0]) {
        try {
          // sync snapshot only — actual play sample done later
          playOk = !videos[0].paused && videos[0].readyState >= 2 && videos[0].currentTime > 0
        } catch (e) {
          playErr = String(e.message || e)
        }
      }
      const drama =
        tab === '短剧'
          ? {
              panelPresent: !!document.querySelector('.drama-panel, [class*="drama"]'),
              hashtagTexts: q('.hashtag, .drama-panel span, [class*="hashtag"]')
                .map(text)
                .filter((t) => t.startsWith('#') || t.includes('全部'))
                .slice(0, 12),
              dramaCardCount: q('.drama-card, [class*="drama-card"]').length,
              dramaTitles: q('.drama-card p, .drama-card, [class*="drama-card"]')
                .map(text)
                .filter(Boolean)
                .slice(0, 6),
            }
          : null
      return {
        clickedTabVisible: q('nav.tabs button.is-active, .tab.is-active, .van-tab--active')
          .map(text)
          .includes(tab),
        slideCount: slides.length,
        videoCount: videos.length,
        hasVideos: videos.length > 0,
        titles,
        firstSrc: firstSrc.slice(0, 140),
        muted: videos[0]?.muted ?? null,
        paused: videos[0]?.paused ?? null,
        readyState: videos[0]?.readyState ?? null,
        currentTime: videos[0] ? +videos[0].currentTime.toFixed(2) : null,
        playOkSnapshot: playOk,
        playErr,
        sideChrome: text(document.querySelector('.short-slide__side, aside')).slice(0, 180),
        drama,
      }
    }, tabName)

    // Try force play on first video for sample
    let playSample = { attempted: false }
    if (data.hasVideos) {
      playSample = await page.evaluate(async () => {
        const v = document.querySelector('video')
        if (!v) return { attempted: false }
        const before = { paused: v.paused, t: v.currentTime, rs: v.readyState, muted: v.muted }
        try {
          v.muted = true
          await v.play()
          await new Promise((r) => setTimeout(r, 1200))
          return {
            attempted: true,
            before,
            after: {
              paused: v.paused,
              t: +v.currentTime.toFixed(2),
              rs: v.readyState,
              muted: v.muted,
              error: v.error ? v.error.code : null,
            },
            success: !v.paused && v.readyState >= 2 && (v.currentTime > 0 || before.t > 0),
          }
        } catch (e) {
          return { attempted: true, before, error: String(e.message || e), success: false }
        }
      })
    }

    const newApis = apiCalls.slice(beforeApis)
    perTab[tabName] = {
      clicked,
      ...data,
      playSample,
      apisDuringTab: newApis,
      usedCategorieId: newApis.some((c) => /videos\/short\?.*categorieId=/i.test(c.url)),
      usedShortAndImg: newApis.some((c) => /videos\/shortAndImg/i.test(c.url)),
    }
  }

  // mute toggle sample on 抖阴
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('nav.tabs button, .tabs .tab, button.tab')]
    const el = btns.find((b) => (b.textContent || '').trim() === '抖阴')
    el?.click()
  })
  await page.waitForTimeout(2000)

  const muteToggle = await page.evaluate(() => {
    const acts = [...document.querySelectorAll('.side-act, [class*="side"] span, [class*="action"]')]
    const muteBtn = acts.find((a) => /静音|打开|🔇|🔊|音/.test(a.textContent || ''))
    const v = document.querySelector('video')
    if (!v) return { hasVideo: false }
    const before = v.muted
    if (muteBtn) muteBtn.click()
    return {
      hasVideo: true,
      muteControlPresent: !!muteBtn,
      muteLabel: muteBtn ? (muteBtn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20) : null,
      mutedBefore: before,
      mutedAfter: v.muted,
      toggled: muteBtn ? before !== v.muted : false,
      note: muteBtn ? 'clicked mute-ish control' : 'no mute control found',
    }
  })

  await ctx.close()
  return {
    base,
    shell,
    perTab,
    apiCalls: apiCalls.slice(0, 40),
    usesShortCategorieId: apiCalls.some((c) => /videos\/short\?.*categorieId=/i.test(c.url)),
    usesShortAndImg: apiCalls.some((c) => /videos\/shortAndImg/i.test(c.url)),
    usesShortCate: apiCalls.some((c) => /videos\/shortCate/i.test(c.url)),
    muteToggle,
  }
}

function score(origin, clone) {
  const gaps = []
  let pts = 0
  let max = 0

  const add = (ok, w, gap) => {
    max += w
    if (ok) pts += w
    else if (gap) gaps.push(gap)
  }

  const oTabs = origin.shell.tabs.filter((t) => EXPECTED_TABS.includes(t))
  const cTabs = clone.shell.tabs.filter((t) => EXPECTED_TABS.includes(t))
  add(EXPECTED_TABS.every((t) => cTabs.includes(t)), 15, `Clone missing tabs: ${EXPECTED_TABS.filter((t) => !cTabs.includes(t)).join(',') || 'none'}`)
  add(oTabs.length === cTabs.length || cTabs.length === EXPECTED_TABS.length, 5, 'Tab count mismatch vs expected')

  add(!!clone.shell.scrollSnap?.includes('mandatory') || !!clone.shell.scrollSnap?.includes('y'), 8, 'Clone missing vertical scroll-snap feed')
  add(clone.shell.chromeHits.includes('分享') && clone.shell.chromeHits.includes('打赏'), 8, 'Clone missing share/reward chrome labels')
  add(clone.shell.chromeHits.includes('客服'), 3, 'Clone missing 客服 chrome')

  add(clone.usesShortCategorieId, 15, 'Clone does not call videos/short?categorieId=')
  add(origin.usesShortCategorieId === clone.usesShortCategorieId || clone.usesShortCategorieId, 5, 'API pattern mismatch vs origin')

  let playOk = 0
  let playN = 0
  const feedDiff = []
  for (const tab of EXPECTED_TABS) {
    const o = origin.perTab[tab]
    const c = clone.perTab[tab]
    if (tab === '短剧') {
      add(!!c?.drama?.panelPresent, 8, 'Clone 短剧: missing drama panel')
      add((c?.drama?.dramaCardCount || 0) > 0, 4, 'Clone 短剧: no drama cards')
      continue
    }
    add(!!c?.clicked, 2, `Clone could not click tab ${tab}`)
    add((c?.slideCount || 0) > 0 || (c?.videoCount || 0) > 0, 4, `Clone ${tab}: empty feed`)
    if (c?.playSample?.attempted) {
      playN++
      if (c.playSample.success) playOk++
    }
    if (c?.usedCategorieId) {
      /* ok */
    } else if (tab !== '短剧') {
      gaps.push(`Clone ${tab}: no categorieId request observed during tab`)
    }
    const oTitles = (o?.titles || []).join('|')
    const cTitles = (c?.titles || []).join('|')
    if (oTitles && cTitles && oTitles === cTitles) feedDiff.push(`${tab}: identical titles to origin (may be ok if same API)`)
  }

  const playRate = playN ? +((playOk / playN) * 100).toFixed(1) : 0
  add(playRate >= 60, 10, `Play success rate low: ${playRate}% (${playOk}/${playN})`)
  add(playRate >= 80, 5, null)

  // mute: clone shows muted autoplay (origin typically too); functional unmute may be stub
  add(clone.shell.mutedCount > 0 || clone.muteToggle?.mutedBefore === true, 4, 'Clone videos not muted by default')
  if (clone.muteToggle?.muteControlPresent && !clone.muteToggle?.toggled) {
    gaps.push('Mute control present but does not toggle video.muted (UI chrome only)')
  }

  const pct = max ? +((pts / max) * 100).toFixed(1) : 0
  return { pct, pts, max, gaps: [...new Set(gaps.filter(Boolean))], playRate, playOk, playN, feedDiff }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  console.error('Scraping origin...')
  const origin = await scrapeSite(browser, ORIGIN)
  console.error('Scraping clone...')
  const clone = await scrapeSite(browser, CLONE)
  await browser.close()

  const verdict = score(origin, clone)

  // per-tab feed diversity on clone
  const cloneTitleSets = {}
  for (const tab of EXPECTED_TABS) {
    cloneTitleSets[tab] = clone.perTab[tab]?.titles || []
  }
  const distinctFeeds = new Set(
    EXPECTED_TABS.filter((t) => t !== '短剧').map((t) => (cloneTitleSets[t] || []).join('||')),
  ).size

  const report = {
    at: new Date().toISOString(),
    agent: '03/20',
    page: 'douyin-short',
    origin: ORIGIN + '/#/short',
    clone: CLONE + '/#/short',
    expectedTabs: EXPECTED_TABS,
    verdictPct: verdict.pct,
    playSuccessRateSample: {
      ratePct: verdict.playRate,
      ok: verdict.playOk,
      n: verdict.playN,
      perTab: Object.fromEntries(
        EXPECTED_TABS.map((t) => [
          t,
          {
            success: clone.perTab[t]?.playSample?.success ?? null,
            attempted: clone.perTab[t]?.playSample?.attempted ?? false,
            detail: clone.perTab[t]?.playSample || null,
            usedCategorieId: clone.perTab[t]?.usedCategorieId,
            usedShortAndImg: clone.perTab[t]?.usedShortAndImg,
            videoCount: clone.perTab[t]?.videoCount,
            titles: clone.perTab[t]?.titles,
          },
        ]),
      ),
    },
    gaps: verdict.gaps,
    ui: {
      originTabs: origin.shell.tabs,
      cloneTabs: clone.shell.tabs,
      originSnap: origin.shell.scrollSnap,
      cloneSnap: clone.shell.scrollSnap,
      originChrome: origin.shell.chromeHits,
      cloneChrome: clone.shell.chromeHits,
      cloneSide: clone.shell.sideText,
      muteToggle: clone.muteToggle,
      distinctNonDramaFeeds: distinctFeeds,
    },
    api: {
      originUsesShortCategorieId: origin.usesShortCategorieId,
      cloneUsesShortCategorieId: clone.usesShortCategorieId,
      originUsesShortAndImg: origin.usesShortAndImg,
      cloneUsesShortAndImg: clone.usesShortAndImg,
      originSample: origin.apiCalls.slice(0, 8),
      cloneSample: clone.apiCalls.slice(0, 8),
    },
    drama: {
      origin: origin.perTab['短剧']?.drama,
      clone: clone.perTab['短剧']?.drama,
    },
    originPerTab: Object.fromEntries(
      EXPECTED_TABS.map((t) => [
        t,
        {
          videoCount: origin.perTab[t]?.videoCount,
          titles: origin.perTab[t]?.titles,
          usedCategorieId: origin.perTab[t]?.usedCategorieId,
          drama: origin.perTab[t]?.drama,
          playSample: origin.perTab[t]?.playSample,
        },
      ]),
    ),
    clonePerTab: Object.fromEntries(
      EXPECTED_TABS.map((t) => [
        t,
        {
          videoCount: clone.perTab[t]?.videoCount,
          titles: clone.perTab[t]?.titles,
          usedCategorieId: clone.perTab[t]?.usedCategorieId,
          usedShortAndImg: clone.perTab[t]?.usedShortAndImg,
          drama: clone.perTab[t]?.drama,
          playSample: clone.perTab[t]?.playSample,
          sideChrome: clone.perTab[t]?.sideChrome,
        },
      ]),
    ),
    codeNotes: {
      file: 'src/views/DouyinPage.vue',
      fetchShortByCategorie: '/videos/short?categorieId=',
      fetchShortAndImg: 'fallback when no categorieId (短剧)',
      categoriesJson: 'src/data/short-categories.json (5 cats, no 短剧 id)',
      mutedAutoplay: true,
      muteControl: 'UI label only (🔇打开) — no click handler',
    },
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.error(`Wrote ${OUT}`)
  console.error(`VERDICT ${report.verdictPct}% | play ${report.playSuccessRateSample.ratePct}% (${report.playSuccessRateSample.ok}/${report.playSuccessRateSample.n})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
