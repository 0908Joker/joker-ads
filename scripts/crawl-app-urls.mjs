#!/usr/bin/env node
/** 从原站内存/localStorage 提取全部 app 链接数据 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'app-links-full.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let round = 0; round < 12; round++) {
    const closed = await page.evaluate(() => {
      let n = 0
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, [class*="close"]').forEach((el) => {
        el.click?.()
        n++
      })
      document.querySelectorAll('.van-overlay').forEach((el) => el.click?.())
      return n
    })
    await page.keyboard.press('Escape').catch(() => {})
    const visible = await page.locator('.van-popup, .van-overlay').count().catch(() => 0)
    if (visible === 0 && closed === 0) break
    await page.waitForTimeout(200)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)
  await dismissPopups(page)
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await dismissPopups(page)

  const extracted = await page.evaluate(async () => {
    const result = { sources: [], apps: [] }
    const pushApps = (list, source) => {
      if (!Array.isArray(list)) return
      const mapped = list
        .filter((x) => x?.name)
        .map((x) => ({
          name: x.name,
          url: x.orgUrl || x.url || x.jumpUrl || '',
          signUrl: x.url && /ad\/sign/.test(x.url) ? x.url : x.signUrl || '',
          id: x.id || x._id || '',
          category: x.category || x.cateName || '',
        }))
      if (mapped.length) result.sources.push({ source, count: mapped.length })
      for (const m of mapped) {
        const i = result.apps.findIndex((a) => a.name === m.name)
        if (i < 0) result.apps.push(m)
        else {
          if (!result.apps[i].url && m.url) result.apps[i].url = m.url
          if (!result.apps[i].signUrl && m.signUrl) result.apps[i].signUrl = m.signUrl
          if (!result.apps[i].id && m.id) result.apps[i].id = m.id
        }
      }
    }

    const nuxt = window.$nuxt
    const main = nuxt?.$main
    const adManager = main?.adManager

    try {
      const allAd = await adManager?.getAllAD?.()
      if (allAd) {
        for (const [k, v] of Object.entries(allAd)) pushApps(v, `getAllAD.${k}`)
      }
    } catch (e) {
      result.getAllADError = String(e)
    }

    const tryKeys = ['appAds', 'apps', 'appList', 'gridApps', 'navigationApps', 'recommendApps']
    for (const key of tryKeys) {
      pushApps(main?.[key], `main.${key}`)
      pushApps(nuxt?.$store?.state?.[key], `store.${key}`)
    }

    // localStorage encrypted
    for (const key of Object.keys(localStorage)) {
      if (/app/i.test(key)) result.localStorageKeys = [...(result.localStorageKeys || []), key]
    }

    // walk component tree for app arrays
    const walk = (obj, depth = 0, path = '') => {
      if (!obj || depth > 10) return
      if (Array.isArray(obj) && obj.length >= 50 && obj[0]?.name) {
        pushApps(obj, `walk:${path}`)
        return
      }
      if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) walk(v, depth + 1, path ? `${path}.${k}` : k)
      }
    }
    walk(main, 0, 'main')
    walk(nuxt?.$store?.state, 0, 'store')

    return result
  })

  console.log('extracted sources:', extracted.sources)
  console.log('apps from memory:', extracted.apps.length)

  // click crawl sample + full if time permits
  const clickResults = []
  const count = await page.locator('.app-card').count()
  console.log(`click crawl ${count} cards...`)

  for (let i = 0; i < count; i++) {
    await dismissPopups(page)
    const card = page.locator('.app-card').nth(i)
    await card.scrollIntoViewIfNeeded().catch(() => {})
    const name = await card.evaluate((el) => el.querySelector('.app-card__name')?.textContent?.trim() || el.textContent?.trim())

    const captured = { signUrl: '', popupUrl: '', navUrl: '' }
    const onReq = (req) => {
      const u = req.url()
      if (/ad\/sign/.test(u)) captured.signUrl = u
    }
    page.on('request', onReq)
    const popupP = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null)

    await card.click({ force: true, timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(600)
    const popup = await popupP
    if (popup) captured.popupUrl = popup.url()
    page.off('request', onReq)

    if (captured.signUrl || captured.popupUrl) {
      clickResults.push({ name, ...captured })
      const existing = extracted.apps.find((a) => a.name === name)
      if (existing) {
        if (!existing.signUrl && captured.signUrl) existing.signUrl = captured.signUrl
        if (!existing.url && captured.popupUrl) existing.url = captured.popupUrl
      } else {
        extracted.apps.push({ name, url: captured.popupUrl, signUrl: captured.signUrl })
      }
    }

    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${count} clicks, links: ${clickResults.length}`)
    if (popup) await popup.close().catch(() => {})
    await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(300)
  }

  const out = {
    at: new Date().toISOString(),
    sources: extracted.sources,
    localStorageKeys: extracted.localStorageKeys,
    apps: extracted.apps,
    clickCount: clickResults.length,
    withUrl: extracted.apps.filter((a) => a.url).length,
    withSign: extracted.apps.filter((a) => a.signUrl).length,
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(`✅ saved ${OUT}`)
  console.log(`apps: ${out.apps.length}, url: ${out.withUrl}, sign: ${out.withSign}, clicks: ${out.clickCount}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
