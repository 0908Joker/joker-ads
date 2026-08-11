#!/usr/bin/env node
/** 爬取各分类 Tab + 各模式下的 app 列表（官方推荐上抓 modes） */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'crawled', 'category-apps.json')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function dismissPopups(page) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .popup-close').forEach((el) => el.click?.())
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

async function clickMode(page, label) {
  await page.locator('.mode-switch__item, .mode-switch button').filter({ hasText: label }).first().click({ force: true, timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(800)
}

async function clickTab(page, tab) {
  await page.locator('.hero__tab, .hero__tabs button').filter({ hasText: tab }).first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(800)
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
  const modesByCategory = {}

  for (const tab of tabs) {
    await clickTab(page, tab)
    byCategory[tab] = await getAppNames(page)
    console.log(`${tab}: ${byCategory[tab].length} apps`)

    const modeLists = {}
    for (const mode of ['站长推荐', '热门下载']) {
      await clickMode(page, mode)
      modeLists[mode] = await getAppNames(page)
      console.log(`  ${tab} / ${mode}: ${modeLists[mode].length}`)
    }
    modesByCategory[tab] = modeLists
    await clickMode(page, '站长推荐')
  }

  const modes = modesByCategory['官方推荐'] || {
    站长推荐: byCategory['官方推荐'] || [],
    热门下载: modesByCategory[Object.keys(modesByCategory)[0]]?.['热门下载'] || [],
  }

  const payload = { at: new Date().toISOString(), tabs, byCategory, modes, modesByCategory }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))

  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  config.categoryApps = config.categoryApps || {}
  config.categoryApps.byCategory = byCategory
  config.categoryApps.modes = modes
  config.categoryApps.modesByCategory = modesByCategory

  const list = byCategory['官方推荐'] || []
  const idx = list.indexOf('杏吧探花')
  if (idx >= 0 && !list.includes('免费黄片')) list[idx] = '免费黄片'

  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
  console.log(`✅ ${OUT} + config.categoryApps updated`)
  await browser.close()
}

main()
