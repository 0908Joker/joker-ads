#!/usr/bin/env node
/** 最终整理：生成 apps 配置 + 下载 cover 图 + 提取全部 orgUrl 链接 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'crawled')
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const api = JSON.parse(fs.readFileSync(path.join(OUT, 'api/in-page/browser-api.json'), 'utf8'))
const resBase = api.resBase || 'https://d17e80montytxe.cloudfront.net'
const token = api.token

function hashStr(s) { return crypto.createHash('md5').update(s).digest('hex').slice(0, 12) }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

// 递归提取所有广告条目
const allAds = []
function collectAds(obj, section = '') {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (item && typeof item === 'object' && (item.name || item.url)) {
        allAds.push({ ...item, _section: section })
      }
      collectAds(item, section)
    })
    return
  }
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length && v[0]?.name) collectAds(v, k)
    else if (typeof v === 'object') collectAds(v, k)
  }
}

collectAds(api.getAllAD || api.getAppModule?.data)

// 去重按 name
const appMap = new Map()
for (const ad of allAds) {
  if (!ad.name) continue
  if (!appMap.has(ad.name) || ad.orgUrl) {
    appMap.set(ad.name, {
      name: ad.name,
      url: ad.orgUrl || ad.url || '',
      signUrl: ad.url?.startsWith('http') ? ad.url : '',
      cover: ad.coverUrl ? `${resBase}/${ad.coverUrl.replace(/^\/+/, '')}` : '',
      coverRelative: ad.coverUrl || '',
      section: ad._section,
      id: ad.id,
    })
  }
}

const apps = [...appMap.values()]
console.log(`整理 ${apps.length} 个应用/广告条目`)

// 下载 cover 图
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ userAgent: UA })).newPage()

const headers = token ? { Authorization: token, token } : {}
let downloaded = 0

for (const app of apps) {
  if (!app.cover) continue
  try {
    const r = await page.request.get(app.cover, { headers, timeout: 15000 })
    if (!r.ok()) continue
    const buf = await r.body()
    const ext = path.extname(new URL(app.cover).pathname.split('@')[0]) || '.webp'
    const dir = path.join(OUT, 'covers')
    ensureDir(dir)
    const fp = path.join(dir, `${hashStr(app.cover)}${ext}`)
    fs.writeFileSync(fp, buf)
    app.iconLocal = path.relative(ROOT, fp).replace(/\\/g, '/')
    downloaded++
  } catch {}
}
await browser.close()
console.log(`下载 ${downloaded} 个 cover 图标`)

// 链接树
const linkTree = {
  apiBase: api.apiBase,
  resBase,
  sections: {},
}
for (const app of apps) {
  const sec = app.section || 'other'
  if (!linkTree.sections[sec]) linkTree.sections[sec] = []
  linkTree.sections[sec].push({ name: app.name, url: app.url, signUrl: app.signUrl, icon: app.iconLocal })
}

fs.writeFileSync(path.join(OUT, 'apps-full.json'), JSON.stringify(apps, null, 2))
fs.writeFileSync(path.join(OUT, 'link-tree-full.json'), JSON.stringify(linkTree, null, 2))

// 更新 src/data/config.json 的 apps（带链接和图标）
const configPath = path.join(ROOT, 'src/data/config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
config.apps = apps.map(a => ({
  name: a.name,
  url: a.url,
  icon: a.iconLocal ? `/${a.iconLocal.replace(/^public\//, '')}` : '',
}))
config.crawled = {
  at: new Date().toISOString(),
  total: apps.length,
  apiBase: api.apiBase,
  resBase,
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
console.log('已更新 src/data/config.json')
