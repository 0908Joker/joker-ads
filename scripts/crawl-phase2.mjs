#!/usr/bin/env node
/** Phase 2: 从 DOM + 浏览器内 API 提取全部链接/GIF/图标 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'crawled')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

function hashStr(s) { return crypto.createHash('md5').update(s).digest('hex').slice(0, 12) }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

let manifest = { assets: [], gifs: [], links: [] }
try {
  manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'api-tree.json'), 'utf8'))
} catch {}
const downloaded = new Set([...(manifest.assets || []).map(a => a.url)])

async function dl(page, url, subdir) {
  if (!url || downloaded.has(url)) return null
  downloaded.add(url)
  const abs = url.startsWith('http') ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`
  try {
    const r = await page.request.get(abs, { timeout: 20000 })
    if (!r.ok()) return null
    const buf = await r.body()
    const ext = path.extname(new URL(abs).pathname) || '.bin'
    const dir = path.join(OUT, subdir)
    ensureDir(dir)
    const fp = path.join(dir, `${hashStr(abs)}${ext}`)
    fs.writeFileSync(fp, buf)
    return { url: abs, local: path.relative(ROOT, fp), size: buf.length }
  } catch { return null }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()

  const allLinks = new Set()
  const allApps = []

  page.on('response', async (resp) => {
    const url = resp.url()
    if (/\.(gif|png|jpg|jpeg|webp|svg)(\?|$)/i.test(url)) {
      const sub = /\.gif/i.test(url) ? 'gifs' : 'icons'
      const e = await dl(page, url, sub)
      if (e) (sub === 'gifs' ? manifest.gifs : manifest.assets).push(e)
    }
  })

  console.log('Phase 2: 加载 appcenter...')
  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(8000)

  // 关闭弹窗
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(400)
  }

  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(5000)

  // 滚动触发懒加载
  for (let i = 0; i < 15; i++) {
    await page.evaluate(y => window.scrollTo(0, y), i * 400)
    await page.waitForTimeout(600)
  }

  // 从 DOM 提取全部 app 数据
  const domData = await page.evaluate(() => {
    const apps = []
    const links = []
    document.querySelectorAll('.app-card, [class*="app-card"]').forEach(card => {
      const name = card.textContent?.trim() || ''
      const img = card.querySelector('img')
      const src = img?.src || img?.getAttribute('data-src') || ''
      if (name) apps.push({ name, icon: src })
    })
    document.querySelectorAll('a[href]').forEach(a => links.push({ text: a.textContent?.trim(), href: a.href }))
    document.querySelectorAll('img[src]').forEach(img => {
      const s = img.src || img.getAttribute('data-src')
      if (s) links.push({ type: 'img', src: s })
    })
    // 尝试从 Vue 实例获取
    let vueApps = null
    try {
      const nuxt = window.$nuxt
      if (nuxt?.$store?.state) vueApps = JSON.stringify(nuxt.$store.state).slice(0, 50000)
    } catch {}
    return { apps, links, vueApps }
  })

  console.log(`DOM apps: ${domData.apps.length}, links: ${domData.links.length}`)

  // 浏览器内调用 API
  const inPageApi = await page.evaluate(async () => {
    const results = {}
    try {
      const nuxt = window.$nuxt
      if (!nuxt?.$api) return { error: 'no $api' }
      const api = nuxt.$api
      const calls = [
        ['getAppModule', () => api.getAppModule?.({ pid: nuxt.$env?.pid || 'FBI' })],
        ['getAllAD', () => nuxt.$main?.adManager?.getAllAD?.()],
        ['adAll', () => api.getAdAll?.() || api.getAllAd?.()],
      ]
      for (const [name, fn] of calls) {
        try {
          const r = await fn()
          results[name] = r
        } catch (e) { results[name] = { error: String(e) } }
      }
      results.token = nuxt.$userStore?.token || nuxt.$userStore?.getToken?.()
      results.apiBase = nuxt.$checkLine?.getApiBaseUrl?.()
      results.resBase = nuxt.$checkLine?.getResBaseUrl?.()
    } catch (e) { results.error = String(e) }
    return results
  })

  ensureDir(path.join(OUT, 'api', 'in-page'))
  fs.writeFileSync(path.join(OUT, 'api', 'in-page', 'browser-api.json'), JSON.stringify(inPageApi, null, 2))
  fs.writeFileSync(path.join(OUT, 'dom-apps.json'), JSON.stringify(domData.apps, null, 2))

  // 递归提取 inPageApi 中所有 URL
  function extractUrls(obj, out = new Set(), d = 0) {
    if (d > 15 || obj == null) return out
    if (typeof obj === 'string') {
      if (/^https?:\/\//.test(obj)) out.add(obj)
      else if (/\.(gif|png|jpg|jpeg|webp)/i.test(obj)) out.add(obj)
      return out
    }
    if (Array.isArray(obj)) obj.forEach(v => extractUrls(v, out, d + 1))
    else if (typeof obj === 'object') Object.values(obj).forEach(v => extractUrls(v, out, d + 1))
    return out
  }

  const urls = extractUrls(inPageApi)
  domData.apps.forEach(a => { if (a.icon) urls.add(a.icon) })
  domData.links.forEach(l => { if (l.href) allLinks.add(l.href); if (l.src) urls.add(l.src) })

  console.log(`下载 ${urls.size} 个 URL...`)
  for (const u of urls) {
    const sub = /\.gif/i.test(u) ? 'gifs' : /\.(png|jpg|jpeg|webp|svg)/i.test(u) ? 'icons' : 'assets'
    const e = await dl(page, u, sub)
    if (e) (sub === 'gifs' ? manifest.gifs : manifest.assets).push(e)
  }

  // 合并 apps 配置
  const appsConfig = domData.apps.length
    ? domData.apps
    : JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config.json'), 'utf8')).apps.map(n => ({ name: n }))

  fs.writeFileSync(path.join(OUT, 'apps-with-icons.json'), JSON.stringify(appsConfig, null, 2))

  manifest.links = [...allLinks, ...domData.links.filter(l => l.href).map(l => l.href)]
  manifest.summary = {
    ...(manifest.summary || {}),
    domApps: domData.apps.length,
    downloadedIcons: manifest.assets.length,
    downloadedGifs: manifest.gifs.length,
    inPageApiKeys: Object.keys(inPageApi),
  }
  fs.writeFileSync(path.join(OUT, 'api-tree.json'), JSON.stringify(manifest, null, 2))

  console.log('Phase 2 完成:', manifest.summary)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
