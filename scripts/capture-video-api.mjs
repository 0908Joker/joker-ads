#!/usr/bin/env node
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  viewport: { width: 390, height: 844 },
})
const page = await ctx.newPage()

const captured = []
page.on('response', async (resp) => {
  const url = resp.url()
  if (!/\/videos\/(recommend|filter|shortAndImg)/.test(url)) return
  try {
    const j = await resp.json()
    captured.push({ url, errorCode: j.errorCode, dataType: typeof j.data, sample: JSON.stringify(j).slice(0, 200) })
  } catch {}
})

await page.goto('https://fbi.xdx794.com/#/videosPage', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(5000)

const inMemory = await page.evaluate(() => {
  const nuxt = window.$nuxt
  const store = nuxt?.$store
  const out = []
  const walk = (obj, d = 0) => {
    if (!obj || d > 8) return
    if (Array.isArray(obj) && obj.length && obj[0]?.title && (obj[0].coverImg || obj[0].cover)) {
      out.push(obj.slice(0, 2))
      return
    }
    if (typeof obj === 'object') for (const v of Object.values(obj)) walk(v, d + 1)
  }
  walk(nuxt?.$main)
  walk(store?.state)
  return out.map((a) => a.map((x) => ({ title: x.title, cover: x.coverImg || x.cover })))
})

console.log('captured', captured)
console.log('inMemory', JSON.stringify(inMemory, null, 2).slice(0, 1500))
await browser.close()
