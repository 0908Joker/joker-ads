#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  const names = config.apps.filter((a) => !a.url && !a.signUrl).map((a) => a.name)
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  const internal = {}

  for (const name of names) {
    await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(400)
    const card = page.locator('.app-card').filter({ hasText: name }).first()
    if (!(await card.count())) { console.log(name, 'NOT FOUND'); continue }
    await card.click({ force: true }).catch(() => {})
    await page.waitForTimeout(1200)
    const hash = await page.evaluate(() => location.hash)
    if (hash !== '#/appcenter') {
      internal[name] = hash.replace('#', '')
      console.log(name, '->', hash)
    } else {
      console.log(name, '-> no nav')
    }
  }

  fs.writeFileSync(path.join(ROOT, 'crawled/app-internal-routes.json'), JSON.stringify(internal, null, 2))
  await browser.close()
}
main()
