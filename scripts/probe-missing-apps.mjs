#!/usr/bin/env node
import { chromium } from 'playwright'

const SITE = 'https://fbi.xdx794.com'
const NAMES = ['免费直播', '超嫩少女', '香蕉破解版', '小红书', '推特', '51看片']
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3000)
  for (const name of NAMES) {
    await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(500)
    const card = page.locator('.app-card').filter({ hasText: name }).first()
    if (!(await card.count())) { console.log(name, 'NOT FOUND'); continue }
    const before = await page.evaluate(() => location.hash)
    let sign = ''
    page.on('request', (r) => { if (/ad\/sign/.test(r.url())) sign = r.url() })
    await card.click({ force: true }).catch(() => {})
    await page.waitForTimeout(1500)
    const after = await page.evaluate(() => location.hash)
    console.log(name, 'hash', before, '->', after, 'sign', sign || '-')
  }
  await browser.close()
}
main()
