#!/usr/bin/env node
/** 爬取各分类 Tab 下的 app 列表 + 补抓缺失链接 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'category-apps.json')
const SITE = 'https://fbi.xdx794.com'
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

async function getAppNames(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.app-card')].map(
      (el) => el.querySelector('.app-card__name')?.textContent?.trim() || el.textContent?.trim(),
    ),
  )
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)

  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('.hero__tab, .hero__tabs button')].map((el) => el.textContent?.trim()).filter(Boolean),
  )

  const byCategory = {}
  for (const tab of tabs) {
    await page.locator('.hero__tab, .hero__tabs button').filter({ hasText: tab }).first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(800)
    byCategory[tab] = await getAppNames(page)
    console.log(`${tab}: ${byCategory[tab].length} apps`)
  }

  // 模式切换
  const modes = {}
  for (const mode of ['站长推荐', '热门下载']) {
    await page.locator('.mode-switch__item, .mode-switch button').filter({ hasText: mode }).first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(800)
    modes[mode] = await getAppNames(page)
    console.log(`${mode}: ${modes[mode].length} apps`)
  }

  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), tabs, byCategory, modes }, null, 2))
  console.log(`✅ ${OUT}`)
  await browser.close()
}

main()
