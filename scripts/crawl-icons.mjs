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

const hashStr = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10)
const isGif = (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49
const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50

async function blobToBuf(page, url) {
  const bytes = await page.evaluate(async (u) => {
    const res = await fetch(u)
    return Array.from(new Uint8Array(await res.arrayBuffer()))
  }, url)
  return Buffer.from(bytes)
}

async function imgToBuf(page, src) {
  if (!src) return null
  if (/^https?:\/\//i.test(src)) {
    const res = await page.request.get(src).catch(() => null)
    if (res?.ok()) return Buffer.from(await res.body())
  }
  if (src.startsWith('blob:')) {
    return blobToBuf(page, src).catch(() => null)
  }
  if (src.startsWith('data:image/')) {
    const b64 = src.split(',')[1]
    return b64 ? Buffer.from(b64, 'base64') : null
  }
  return null
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({
      userAgent: UA,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    })
  ).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  }
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)

  const count = await page.locator('.app-card').count()
  console.log(`共 ${count} 个 app-card，逐个抓取原始 GIF/PNG...`)

  const apps = []
  let gifs = 0
  let pngs = 0

  for (let i = 0; i < count; i++) {
    const card = page.locator('.app-card').nth(i)
    await card.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(250)

    const meta = await card.evaluate((el) => {
      const name = (el.querySelector('.app-card__name')?.textContent || el.textContent || '').trim()
      const img = el.querySelector('img')
      if (!img) return { name, src: '' }
      return { name, src: img.currentSrc || img.src || '', w: img.naturalWidth, h: img.naturalHeight }
    })

    if (!meta.name) continue

    let icon = ''
    if (meta.src && meta.w > 1) {
      const buf = await imgToBuf(page, meta.src)
      if (buf && buf.length > 300) {
        const ext = isGif(buf) ? 'gif' : 'png'
        const fname = `${hashStr(meta.name + i)}.${ext}`
        fs.writeFileSync(path.join(OUT, fname), buf)
        icon = `/icons/${fname}`
        if (ext === 'gif') gifs++
        else pngs++
      }
    }

    apps.push({ name: meta.name, icon, src: meta.src?.slice(0, 80) })
    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}`)
  }
  console.log()

  const urlMap = new Map()
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
  for (const list of Object.values(saved.getAllAD || {})) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (item.name && item.orgUrl) urlMap.set(item.name, item.orgUrl)
    }
  }

  const configApps = apps.map((a, i) => ({
    name: a.name,
    url: urlMap.get(a.name) || '',
    icon: a.icon,
  }))

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))
  config.apps = configApps
  config.crawled = {
    at: new Date().toISOString(),
    total: configApps.length,
    gifs,
    pngs,
    iconsSaved: gifs + pngs,
  }
  fs.writeFileSync(path.join(ROOT, 'src/data/config.json'), JSON.stringify(config, null, 2))

  console.log(`✅ ${configApps.length} apps | ${gifs} GIF + ${pngs} PNG`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
