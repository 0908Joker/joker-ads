#!/usr/bin/env node
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await (
  await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    viewport: { width: 390, height: 844 },
  })
).newPage()

await page.goto('https://fbi.xdx794.com/#/launch', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(5000)

const result = await page.evaluate(async () => {
  const nuxt = window.$nuxt
  const token = nuxt?.$userStore?.token
  const base = nuxt?.$env?.apiUrl || 'https://deuwy.jcd9nw.com/api/v1'
  const res = await fetch(`${base}/videos/recommend?page=1&pageSize=2&pid=FBI`, {
    headers: { Authorization: token, token },
  })
  const json = await res.json()
  const crypto = nuxt.$crypto
  const step = crypto.decryption(json.data)
  let dec = null
  try {
    dec = crypto.decryptionObject(json.data)
  } catch (e) {
    dec = { err: String(e) }
  }
  return {
    errorCode: json.errorCode,
    stepLen: step?.length,
    stepHead: step?.slice(0, 80),
    decKeys: dec && !dec.err ? Object.keys(dec) : dec,
    videoName: dec?.videos?.[0]?.name,
  }
})

console.log(JSON.stringify(result, null, 2))
await browser.close()
