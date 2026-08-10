#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'popups')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const hashStr = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10)

function isGifBuf(buf) {
  return buf.length > 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
}

function isPngBuf(buf) {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50
}

async function blobUrlToBuffer(page, url) {
  return page.evaluate(async (u) => {
    const res = await fetch(u)
    const ab = await res.arrayBuffer()
    return Array.from(new Uint8Array(ab))
  }, url)
}

async function savePopupBuffer(buf, index, extHint = '') {
  const ext = isGifBuf(buf) ? 'gif' : isPngBuf(buf) ? 'png' : extHint || 'gif'
  const file = `popup-${index}.${ext}`
  fs.writeFileSync(path.join(OUT, file), buf)
  return { file, ext, size: buf.length }
}

async function captureImgBytes(page, imgLocator) {
  const meta = await imgLocator.evaluate((el) => ({
    src: el.currentSrc || el.src || '',
    w: el.naturalWidth,
    h: el.naturalHeight,
  }))

  if (!meta.src || meta.w < 50) return null

  let buf = null

  if (/^https?:\/\//i.test(meta.src)) {
    const res = await page.request.get(meta.src).catch(() => null)
    if (res?.ok()) buf = Buffer.from(await res.body())
  } else if (meta.src.startsWith('blob:')) {
    const bytes = await blobUrlToBuffer(page, meta.src).catch(() => null)
    if (bytes) buf = Buffer.from(bytes)
  } else if (meta.src.startsWith('data:image/')) {
    const b64 = meta.src.split(',')[1]
    if (b64) buf = Buffer.from(b64, 'base64')
  }

  if (!buf?.length) return null
  return { buf, meta }
}

async function closePopup(page) {
  for (const sel of ['.van-popup__close-icon', '.popup-close', '[class*="close"]']) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(700)
      return true
    }
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)
  return false
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  const networkGifs = []
  page.on('response', async (res) => {
    try {
      const url = res.url()
      const type = res.headers()['content-type'] || ''
      if (!/gif/i.test(url) && !/gif/i.test(type)) return
      const body = Buffer.from(await res.body())
      if (body.length > 2000 && isGifBuf(body)) {
        networkGifs.push({ url, body })
      }
    } catch {}
  })

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)

  const popups = []

  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1200)
    const img = page.locator('.van-popup img, .van-popup--center img').first()
    if (!(await img.isVisible().catch(() => false))) break

    const cap = await captureImgBytes(page, img)
    if (!cap) {
      await closePopup(page)
      continue
    }

    const saved = await savePopupBuffer(cap.buf, popups.length + 1)
    const kind = isGifBuf(cap.buf) ? 'GIF' : isPngBuf(cap.buf) ? 'PNG' : 'BIN'
    console.log(
      `  popup ${popups.length + 1}: ${saved.file} [${kind}] ${cap.meta.w}x${cap.meta.h} ${saved.size}b`,
    )
    popups.push({ image: `/popups/${saved.file}`, url: '', _src: cap.meta.src.slice(0, 100) })

    if (!(await closePopup(page))) break
  }

  // fallback: unused network gifs
  for (const ng of networkGifs) {
    if (popups.length >= 5) break
    if (popups.some((p) => p._src.includes(ng.url.slice(-20)))) continue
    const saved = await savePopupBuffer(ng.body, popups.length + 1)
    console.log(`  network: ${saved.file} ${ng.body.length}b`)
    popups.push({ image: `/popups/${saved.file}`, url: '', _src: ng.url })
  }

  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
  const enterApp = saved.getAllAD?.enterApp || []
  popups.forEach((p, i) => {
    delete p._src
    if (enterApp[i]?.orgUrl) p.url = enterApp[i].orgUrl
    if (enterApp[i]?.name) p.name = enterApp[i].name
  })

  if (!popups.length) {
    console.log('⚠️ 未抓到弹窗')
    await browser.close()
    process.exit(1)
  }

  // remove old fake gif/png popups
  for (const f of fs.readdirSync(OUT)) {
    if (/^popup-\d+\.(gif|png)$/i.test(f)) {
      // keep only newly written - we'll overwrite by same names
    }
  }

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))
  config.popups = popups
  fs.writeFileSync(path.join(ROOT, 'src/data/config.json'), JSON.stringify(config, null, 2))

  const gifCount = popups.filter((p) => p.image.endsWith('.gif')).length
  console.log(`✅ ${popups.length} 弹窗, 其中 ${gifCount} 个真 GIF`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
