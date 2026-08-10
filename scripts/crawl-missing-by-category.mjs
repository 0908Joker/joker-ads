#!/usr/bin/env node
/** 在分类 Tab 下补抓无链接 app */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(100)
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  const targets = new Set(config.apps.filter((a) => !a.url && !a.signUrl).map((a) => a.name))
  if (!targets.size) { console.log('all linked'); return }

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)

  const cats = ['官方推荐', '激情1v1', '免费看片', '高端约炮', '盈利通道', '免费黄游']
  let updated = 0

  for (const cat of cats) {
    if (!targets.size) break
    await page.locator('.hero__tab').filter({ hasText: cat }).first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(800)

    for (const name of [...targets]) {
      const card = page.locator('.app-card').filter({ hasText: name }).first()
      if (!(await card.count())) continue

      const captured = { url: '', signUrl: '' }
      page.on('request', (req) => { if (/ad\/sign/.test(req.url())) captured.signUrl = req.url() })
      const popupP = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null)
      await card.click({ force: true, timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(900)
      const popup = await popupP
      if (popup) {
        const u = popup.url()
        if (/^https?:\/\//.test(u) && !u.includes('chrome-error')) captured.url = u
        await popup.close().catch(() => {})
      }

      if (captured.url || captured.signUrl) {
        const app = config.apps.find((a) => a.name === name)
        if (app) {
          if (captured.url) app.url = captured.url
          if (captured.signUrl) app.signUrl = captured.signUrl
          targets.delete(name)
          updated++
          console.log(`✓ ${name} (${cat})`)
        }
      }
      await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.locator('.hero__tab').filter({ hasText: cat }).first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(400)
    }
  }

  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
  console.log(`updated ${updated}, remaining ${targets.size}:`, [...targets])
  await browser.close()
}

main()
