#!/usr/bin/env node
import { chromium } from 'playwright'

const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(150)
  }
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3000)

  const cardInfo = await page.evaluate(() => {
    const card = document.querySelector('.app-card')
    const attrs = card ? Object.fromEntries([...card.attributes].map((a) => [a.name, a.value])) : {}
    const parent = card?.parentElement
    return {
      attrs,
      parentClass: parent?.className,
      html: card?.outerHTML?.slice(0, 800),
    }
  })
  console.log('cardInfo', JSON.stringify(cardInfo, null, 2))

  const vueApps = await page.evaluate(() => {
    const walk = (obj, depth = 0, path = '') => {
      if (!obj || depth > 8) return []
      const hits = []
      if (Array.isArray(obj) && obj.length >= 20 && obj[0]?.name) {
        hits.push({
          path,
          len: obj.length,
          sample: obj.slice(0, 2).map((x) => ({
            name: x.name,
            url: x.url || x.orgUrl || x.jumpUrl || '',
            id: x.id,
          })),
        })
      }
      if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          hits.push(...walk(v, depth + 1, path ? `${path}.${k}` : k))
        }
      }
      return hits
    }
    const roots = []
    if (window.__NUXT__) roots.push(['__NUXT__', window.__NUXT__])
    const app = document.querySelector('#app')
    if (app?.__vue_app__) roots.push(['__vue_app__', app.__vue_app__])
    if (app?._vnode?.component) roots.push(['_vnode', app._vnode.component])
    const all = []
    for (const [name, root] of roots) all.push(...walk(root).map((h) => ({ root: name, ...h })))
    return all.slice(0, 10)
  })
  console.log('vueApps', JSON.stringify(vueApps, null, 2))

  const reqs = []
  page.on('request', (r) => {
    const u = r.url()
    if (!/xdx794\.com|cloudfront|track\./.test(u) || /sign|jump|ad\//.test(u)) reqs.push(u)
  })

  const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null)
  await page.locator('.app-card').first().click({ timeout: 5000 }).catch((e) => console.log('click err', e.message))
  const popup = await popupPromise
  await page.waitForTimeout(2000)
  console.log('popup url', popup?.url())
  console.log('reqs', reqs.slice(0, 15))

  await browser.close()
}

main()
