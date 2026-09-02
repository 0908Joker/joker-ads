import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLONE = process.env.CLONE_URL || 'https://b12sl5x.cn'

async function dismiss(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.van-popup, .ad-popup, [class*=popup], .popup-overlay').forEach((e) => {
      try { e.remove() } catch {}
    })
  })
}

async function probe(page, hash) {
  await page.goto(`${CLONE}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  await dismiss(page)

  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const bar = q('.search-bar')
    const hist = q('.feat-head__hist, .dark-head__hist')
    const plus = q('.feat-head__plus, .dark-head__plus')
    const words = [...document.querySelectorAll('.search-bar__word')].map((e) => e.textContent.trim())
    const input = q('input[type=search], .search-bar input, input[placeholder*=搜]')
    const clickable = (el) =>
      !!el &&
      !!(
        el.onclick ||
        el.getAttribute('href') ||
        el.tagName === 'A' ||
        el.tagName === 'BUTTON' ||
        el.closest('a,button,[role=button]')
      )
    return {
      hash: location.hash,
      hasBar: !!bar,
      words,
      hasInput: !!input,
      inputPlaceholder: input?.placeholder || null,
      histText: hist?.textContent?.trim() || null,
      plusText: plus?.textContent?.trim() || null,
      barTag: bar?.tagName || null,
      barRole: bar?.getAttribute('role'),
      barTabIndex: bar?.tabIndex,
      histClickable: clickable(hist),
      plusClickable: clickable(plus),
      barClickable: clickable(bar),
      cursor: bar ? getComputedStyle(bar).cursor : null,
      tee: !!q('.feat-head__tee, .dark-head__tee'),
    }
  })

  const clickNav = async (sel) => {
    const el = await page.$(sel)
    if (!el) return { present: false }
    const before = page.url()
    await el.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(900)
    const after = page.url()
    return { present: true, before, after, navigated: before !== after }
  }

  const afterSearch = await clickNav('.search-bar')

  await page.goto(`${CLONE}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1500)
  await dismiss(page)
  const afterHist = await clickNav('.feat-head__hist, .dark-head__hist')

  await page.goto(`${CLONE}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1500)
  await dismiss(page)
  const afterPlus = await clickNav('.feat-head__plus, .dark-head__plus')

  return { hash, info, afterSearch, afterHist, afterPlus }
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
})
const page = await ctx.newPage()
const pages = ['#/videosPage', '#/darkWeb/darkSecond', '#/vipPage', '#/short', '#/circle']
const out = []
for (const h of pages) out.push(await probe(page, h))
await browser.close()

const report = { at: new Date().toISOString(), clone: CLONE, pages: out }
fs.writeFileSync(path.join(ROOT, 'crawled/audit-13-search-bars.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
