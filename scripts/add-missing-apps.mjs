#!/usr/bin/env node
/** 补抓缺失 app（如 P站破解）图标与链接 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICON_DIR = path.join(ROOT, 'public', 'icons')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const TARGETS = ['P站破解', '专业炮台']

const hashStr = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10)

async function dismissPopups(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(150)
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/app-links-full.json'), 'utf8'))
  const linkMap = new Map(links.apps.map((a) => [a.name, a]))

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await dismissPopups(page)

  for (const name of TARGETS) {
    if (config.apps.some((a) => a.name === name)) continue

    const card = page.locator('.app-card').filter({ hasText: name }).first()
    if (!(await card.count())) {
      console.log(`skip ${name}: not found in DOM`)
      continue
    }
    await card.scrollIntoViewIfNeeded().catch(() => {})
    const meta = await card.evaluate((el) => {
      const img = el.querySelector('img')
      return { src: img?.currentSrc || img?.src || '' }
    })

    let icon = ''
    if (meta.src) {
      const bytes = meta.src.startsWith('data:')
        ? Buffer.from(meta.src.split(',')[1], 'base64')
        : Buffer.from(
            await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), meta.src),
          )
      const ext = bytes[0] === 0x47 ? '.gif' : '.png'
      const file = `${hashStr(name)}${ext}`
      fs.writeFileSync(path.join(ICON_DIR, file), bytes)
      icon = `/icons/${file}`
    }

    const link = linkMap.get(name) || {}
    config.apps.push({ name, url: link.url || '', signUrl: link.signUrl || '', icon })
    console.log(`+ ${name} icon=${icon} url=${link.url || ''}`)
  }

  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
  await browser.close()
  console.log(`apps total: ${config.apps.length}`)
}

main()
