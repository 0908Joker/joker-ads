#!/usr/bin/env node
/** 针对无链接 app 二次补抓：监听 sign 响应 + popup + location */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const OUT = path.join(ROOT, 'crawled', 'app-links-retry.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .daily-checkin-dialog .close, [class*="close"]').forEach((el) => el.click?.())
      document.querySelectorAll('.van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  const targets = [...new Set(config.apps.filter((a) => !a.url && !a.signUrl).map((a) => a.name))]
  console.log(`retry ${targets.length} apps`)

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)

  const results = []

  for (const name of targets) {
    await dismissPopups(page)
    const card = page.locator('.app-card').filter({ hasText: name }).first()
    if (!(await card.count())) {
      console.log(`  skip ${name}: not in DOM`)
      continue
    }
    await card.scrollIntoViewIfNeeded().catch(() => {})

    const captured = { name, url: '', signUrl: '', redirect: '' }
    const onReq = (req) => {
      const u = req.url()
      if (/ad\/sign/.test(u)) captured.signUrl = u
    }
    const onResp = async (resp) => {
      const u = resp.url()
      if (/ad\/sign/.test(u)) {
        try {
          const j = await resp.json()
          if (j?.data?.url) captured.redirect = j.data.url
          if (j?.data?.orgUrl) captured.url = j.data.orgUrl
        } catch {}
      }
    }
    page.on('request', onReq)
    page.on('response', onResp)

    const popupP = page.waitForEvent('popup', { timeout: 4000 }).catch(() => null)
    await card.click({ force: true, timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(1200)
    const popup = await popupP
    if (popup) {
      const pu = popup.url()
      if (/^https?:\/\//.test(pu) && !pu.includes('chrome-error')) captured.url = pu
      await popup.close().catch(() => {})
    }

    page.off('request', onReq)
    page.off('response', onResp)

    if (captured.redirect && !captured.url) captured.url = captured.redirect
    if (captured.signUrl || captured.url) {
      results.push(captured)
      console.log(`  ✓ ${name}: ${captured.url || captured.signUrl}`)
    } else {
      console.log(`  ✗ ${name}`)
    }

    await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(300)
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2))

  let updated = 0
  for (const r of results) {
    const app = config.apps.find((a) => a.name === r.name)
    if (!app) continue
    if (r.url && !app.url) { app.url = r.url; updated++ }
    if (r.signUrl) app.signUrl = r.signUrl
  }
  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
  console.log(`✅ updated ${updated}, saved ${OUT}`)
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
