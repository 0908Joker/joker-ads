#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'icons')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const hashStr = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10)

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(200) }
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)

  const count = await page.locator('.app-card').count()
  console.log(`共 ${count} 个 app-card，逐个滚入视口加载...`)

  const apps = []

  for (let i = 0; i < count; i++) {
    const card = page.locator('.app-card').nth(i)
    await card.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(150)

    const data = await card.evaluate(el => {
      const name = el.textContent?.trim() || ''
      const img = el.querySelector('img')
      if (!img) return { name, iconData: null }

      return new Promise(resolve => {
        const draw = () => {
          try {
            if (!img.naturalWidth || img.naturalWidth <= 1) {
              resolve({ name, iconData: null, src: img.src?.slice(0, 80) })
              return
            }
            const canvas = document.createElement('canvas')
            const s = 128
            canvas.width = s
            canvas.height = s
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, s, s)
            resolve({ name, iconData: canvas.toDataURL('image/png'), src: img.src?.slice(0, 80) })
          } catch {
            resolve({ name, iconData: null })
          }
        }
        if (img.complete) draw()
        else { img.onload = draw; img.onerror = () => resolve({ name, iconData: null }); setTimeout(draw, 800) }
      })
    })

    if (data.name) apps.push(data)
    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}`)
  }
  console.log()

  // URL map from saved API
  const urlMap = new Map()
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
  for (const list of Object.values(saved.getAllAD || {})) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (item.name && item.orgUrl) urlMap.set(item.name, item.orgUrl)
    }
  }

  const configApps = []
  let icons = 0

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i]
    if (!app.name) continue
    const entry = { name: app.name, url: urlMap.get(app.name) || '', icon: '' }

    if (app.iconData?.startsWith('data:image/png')) {
      const buf = Buffer.from(app.iconData.split(',')[1], 'base64')
      if (buf.length > 300) {
        const fname = `${hashStr(app.name + i)}.png`
        fs.writeFileSync(path.join(OUT, fname), buf)
        entry.icon = `/icons/${fname}`
        icons++
      }
    }
    configApps.push(entry)
  }

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))
  config.apps = configApps
  config.crawled = { at: new Date().toISOString(), total: configApps.length, iconsSaved: icons }
  fs.writeFileSync(path.join(ROOT, 'src/data/config.json'), JSON.stringify(config, null, 2))

  console.log(`✅ ${configApps.length} apps, ${icons} 图标已导出`)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
