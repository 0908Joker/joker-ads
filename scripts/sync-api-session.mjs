#!/usr/bin/env node
/** Refresh API token from origin launch page → src/data/api-session.json */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/data/api-session.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const browser = await chromium.launch({ headless: true })
const page = await (
  await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
).newPage()

await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(6000)

const session = await page.evaluate(() => {
  const ls = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    ls[k] = localStorage.getItem(k)
  }
  const nuxt = window.$nuxt
  return {
    token: nuxt?.$userStore?.token || ls.token || ls.Token || ls.accessToken || '',
    uid: nuxt?.$userStore?.userInfo?.uid || ls.uid || '',
    localStorageKeys: Object.keys(ls),
  }
})

let fallback = ''
try {
  const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
  fallback = api.token || ''
} catch {}

const payload = {
  at: new Date().toISOString(),
  token: session.token || fallback,
  uid: session.uid || '',
  resBase: 'https://d17e80montytxe.cloudfront.net',
}

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
console.log('✅ api-session token:', payload.token ? `${payload.token.slice(0, 24)}...` : 'MISSING')
await browser.close()
