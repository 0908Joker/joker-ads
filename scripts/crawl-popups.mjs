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

async function capturePopup(page, index) {
  await page.waitForTimeout(1500)

  const selectors = [
    '.van-popup img',
    '.van-popup--center img',
    '[class*="popup"] img',
    '.popup-wrap img',
    '.ad-popup img',
  ]

  for (const sel of selectors) {
    const img = page.locator(sel).first()
    if (!(await img.count())) continue
    if (!(await img.isVisible().catch(() => false))) continue

    const box = await img.boundingBox().catch(() => null)
    if (!box || box.width < 80) continue

    const data = await img.evaluate((el) => {
      const src = el.currentSrc || el.src || ''
      const isGif = /\.gif/i.test(src) || src.startsWith('data:image/gif')
      return new Promise((resolve) => {
        const done = () => {
          try {
            const w = el.naturalWidth || el.width
            const h = el.naturalHeight || el.height
            if (!w || w < 50) return resolve({ src, blob: null, w, h, isGif })
            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            canvas.getContext('2d').drawImage(el, 0, 0, w, h)
            resolve({
              src: src.slice(0, 120),
              blob: canvas.toDataURL(isGif ? 'image/png' : 'image/png'),
              w,
              h,
              isGif,
            })
          } catch (e) {
            resolve({ src, blob: null, error: String(e) })
          }
        }
        if (el.complete) done()
        else {
          el.onload = done
          el.onerror = () => resolve({ src, blob: null })
          setTimeout(done, 2000)
        }
      })
    })

    if (data.blob) {
      return { data, box, sel }
    }
  }

  // fallback: screenshot popup container only
  const popup = page.locator('.van-popup--center, .van-popup').first()
  if (await popup.isVisible().catch(() => false)) {
    const buf = await popup.screenshot({ type: 'png' }).catch(() => null)
    if (buf) return { screenshot: buf }
  }

  return null
}

async function closePopup(page) {
  const closes = [
    '.van-popup__close-icon',
    '.popup-close',
    '[class*="close"]',
    'button:has-text("×")',
  ]
  for (const sel of closes) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(600)
      return true
    }
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)
  return false
}

async function downloadGifFromNetwork(page, outPath) {
  return new Promise((resolve) => {
    const handler = async (res) => {
      const url = res.url()
      if (!/\.gif(\?|$)/i.test(url) && !url.includes('data:image/gif')) return
      try {
        const buf = Buffer.from(await res.body())
        if (buf.length > 1000) {
          fs.writeFileSync(outPath, buf)
          page.off('response', handler)
          resolve(outPath)
        }
      } catch {}
    }
    page.on('response', handler)
    setTimeout(() => {
      page.off('response', handler)
      resolve(null)
    }, 8000)
  })
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

  const gifPromise = downloadGifFromNetwork(page, path.join(OUT, '_pending.gif'))

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)

  const popups = []
  const maxPopups = 5

  for (let i = 0; i < maxPopups; i++) {
    const cap = await capturePopup(page, i)
    if (!cap) break

    let file = ''
    let url = ''

    if (cap.data?.blob) {
      const ext = cap.data.isGif ? 'gif' : 'png'
      file = `popup-${i + 1}.${ext}`
      const buf = Buffer.from(cap.data.blob.split(',')[1], 'base64')
      fs.writeFileSync(path.join(OUT, file), buf)
      console.log(`  popup ${i + 1}: ${file} (${cap.data.w}x${cap.data.h}) via ${cap.sel}`)
    } else if (cap.screenshot) {
      file = `popup-${i + 1}.png`
      fs.writeFileSync(path.join(OUT, file), cap.screenshot)
      console.log(`  popup ${i + 1}: ${file} (container screenshot)`)
    }

    if (file) {
      popups.push({ image: `/popups/${file}`, url: '' })
    }

    const closed = await closePopup(page)
    if (!closed) break
  }

  const pendingGif = await gifPromise
  if (pendingGif && fs.existsSync(pendingGif)) {
    const name = `popup-${hashStr('network')}.gif`
    fs.renameSync(pendingGif, path.join(OUT, name))
    if (!popups.some((p) => p.image.endsWith('.gif'))) {
      popups.unshift({ image: `/popups/${name}`, url: '' })
    }
    console.log(`  network gif: ${name}`)
  }

  // merge enterApp urls from saved API
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
  const enterApp = saved.getAllAD?.enterApp || []
  popups.forEach((p, i) => {
    if (enterApp[i]?.orgUrl) p.url = enterApp[i].orgUrl
    if (enterApp[i]?.name) p.name = enterApp[i].name
  })

  if (!popups.length) {
    console.log('⚠️ 未抓到弹窗，保留现有配置')
    await browser.close()
    return
  }

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8'))
  config.popups = popups
  fs.writeFileSync(path.join(ROOT, 'src/data/config.json'), JSON.stringify(config, null, 2))
  console.log(`✅ ${popups.length} 弹窗已更新`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
