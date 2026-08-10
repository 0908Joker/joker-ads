#!/usr/bin/env node
/** 从原站内存提取 appAds 补全链接 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  const missing = new Set(config.apps.filter((a) => !a.url && !a.signUrl).map((a) => a.name))

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)

  const apps = await page.evaluate(async () => {
    const out = []
    const nuxt = window.$nuxt
    const main = nuxt?.$main
    const adManager = main?.adManager

    // try decrypt appAds from storage
    try {
      const enc = localStorage.getItem('appAds-enc') || localStorage.getItem('appAds')
      if (enc && nuxt?.$crypto) {
        const dec = nuxt.$crypto.decrypt?.(enc) || nuxt.$crypto.AES?.decrypt?.(enc, nuxt.$env?.key)?.toString?.()
        if (dec) {
          const data = typeof dec === 'string' ? JSON.parse(dec) : dec
          if (Array.isArray(data)) out.push(...data)
        }
      }
    } catch {}

    // grid apps from page component
    const walk = (obj, d = 0) => {
      if (!obj || d > 10) return
      if (Array.isArray(obj) && obj.length > 100 && obj[0]?.name && (obj[0].coverUrl || obj[0].url || obj[0].orgUrl)) {
        out.push(...obj)
        return
      }
      if (typeof obj === 'object') for (const v of Object.values(obj)) walk(v, d + 1)
    }
    walk(main?.appAds)
    walk(main?.apps)
    walk(adManager?.context?.apps)

    return out.map((x) => ({
      name: x.name,
      url: x.orgUrl || x.url || x.jumpUrl || '',
      signUrl: x.url && /ad\/sign/.test(x.url) ? x.url : x.signUrl || '',
    }))
  })

  let updated = 0
  const map = new Map(apps.filter((a) => a.name).map((a) => [a.name, a]))
  for (const name of [...missing]) {
    const hit = map.get(name)
    if (!hit) continue
    const app = config.apps.find((a) => a.name === name)
    if (!app) continue
    if (hit.url && /^https?:\/\//.test(hit.url)) { app.url = hit.url; updated++ }
    if (hit.signUrl) { app.signUrl = hit.signUrl; updated++ }
    missing.delete(name)
    console.log(`+ ${name}`, hit.url || hit.signUrl)
  }

  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
  console.log(`memory apps: ${apps.length}, updated: ${updated}, still missing: ${missing.size}`, [...missing])
  await browser.close()
}

main()
