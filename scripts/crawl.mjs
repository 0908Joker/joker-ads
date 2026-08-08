#!/usr/bin/env node
/**
 * 递归爬取 fbi.xdx794.com 全部 API 响应、链接层级与 GIF/静态资源
 * 输出: ../crawled/
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'crawled')
const SITE = 'https://fbi.xdx794.com'
const APP_VER = '1.1.167'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

// 从 JS bundle 提取的已知 API 路径
const KNOWN_PATHS = fs.existsSync(path.join(__dirname, 'endpoints.txt'))
  ? fs.readFileSync(path.join(__dirname, 'endpoints.txt'), 'utf8').trim().split('\n').filter(Boolean)
  : []

const apiTree = { _meta: { site: SITE, crawledAt: new Date().toISOString() }, requests: [], responses: {}, assets: [], gifs: [] }
const downloaded = new Set()
const visitedUrls = new Set()

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function hashStr(s) {
  return crypto.createHash('md5').update(s).digest('hex').slice(0, 12)
}

function safeName(url) {
  return url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

function isGif(url) {
  return /\.gif(\?|$)/i.test(url) || url.includes('data:image/gif')
}

function isAsset(url) {
  return /\.(gif|png|jpg|jpeg|webp|svg|ico|mp4|webm)(\?|$)/i.test(url)
}

function collectUrls(obj, out = new Set(), depth = 0) {
  if (depth > 12 || obj == null) return out
  if (typeof obj === 'string') {
    if (/^https?:\/\//i.test(obj)) out.add(obj)
    else if (obj.startsWith('/') && obj.length > 2) out.add(obj)
    else if (isAsset(obj)) out.add(obj)
    return out
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectUrls(v, out, depth + 1)
    return out
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) collectUrls(v, out, depth + 1)
  }
  return out
}

async function downloadFile(page, url, subdir = 'assets') {
  const abs = url.startsWith('http') ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`
  if (downloaded.has(abs)) return null
  downloaded.add(abs)

  try {
    const resp = await page.request.get(abs, { timeout: 30000 })
    if (!resp.ok()) return null
    const buf = await resp.body()
    const ext = path.extname(new URL(abs).pathname) || (isGif(abs) ? '.gif' : '.bin')
    const name = `${hashStr(abs)}${ext}`
    const dir = path.join(OUT, subdir)
    ensureDir(dir)
    const fp = path.join(dir, name)
    fs.writeFileSync(fp, buf)

    const entry = { url: abs, local: path.relative(ROOT, fp), size: buf.length }
    apiTree.assets.push(entry)
    if (isGif(abs)) apiTree.gifs.push(entry)
    return fp
  } catch (e) {
    return null
  }
}

async function saveApiResponse(url, status, data, contentType) {
  const key = url.replace(/^https?:\/\/[^/]+/, '')
  const dir = path.join(OUT, 'api', ...key.split('/').filter(Boolean).slice(0, -1))
  ensureDir(dir)
  const fname = (key.split('/').pop() || 'index') + `_${hashStr(url)}.json`
  const fp = path.join(dir, fname)

  const record = { url, status, contentType, savedAt: new Date().toISOString(), file: path.relative(ROOT, fp) }

  if (contentType?.includes('json') && data) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2))
    record.type = 'json'
    // 递归收集内嵌 URL
    const nested = [...collectUrls(data)]
    record.nestedUrls = nested.slice(0, 200)
    for (const u of nested) {
      if (isAsset(u)) apiTree._pendingAssets = apiTree._pendingAssets || new Set()
      apiTree._pendingAssets.add(u)
    }
  } else if (typeof data === 'string') {
    fs.writeFileSync(fp, data)
    record.type = 'text'
  }

  apiTree.responses[key] = record
  return record
}

async function main() {
  ensureDir(OUT)
  ensureDir(path.join(OUT, 'api'))
  ensureDir(path.join(OUT, 'assets'))
  ensureDir(path.join(OUT, 'gifs'))

  console.log('🚀 启动 Playwright 爬虫...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
  })
  const page = await context.newPage()

  // 拦截所有网络请求
  page.on('response', async (response) => {
    const url = response.url()
    const status = response.status()
    const ct = response.headers()['content-type'] || ''

    if (visitedUrls.has(url)) return
    visitedUrls.add(url)

    const isApi = url.includes('/api/') || url.includes('api/v1')
    const isStatic = url.includes(`/app/${APP_VER}/`) || url.includes(SITE)

    if (!isApi && !isAsset(url)) return

    apiTree.requests.push({ url, status, contentType: ct, time: Date.now() })

    try {
      if (ct.includes('json') || isApi) {
        const json = await response.json().catch(() => null)
        if (json) await saveApiResponse(url, status, json, ct)
      } else if (isGif(url) || (isAsset(url) && isStatic)) {
        await downloadFile(page, url, isGif(url) ? 'gifs' : 'assets')
      }
    } catch {}
  })

  // 1. 访问 launch 页获取 token
  console.log('📡 访问 launch 页...')
  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(5000)

  // 关闭弹窗
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(500)
    const closeBtn = page.locator('.popup-close, [class*="close"], .van-popup__close-icon').first()
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click().catch(() => {})
      await page.waitForTimeout(500)
    }
  }

  // 2. 访问 appcenter
  console.log('📡 访问 appcenter...')
  await page.goto(`${SITE}/#/appcenter`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)

  // 滚动加载懒加载资源
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.waitForTimeout(800)
  }

  // 3. 提取 localStorage token
  const storage = await page.evaluate(() => {
    const out = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      try { out[k] = localStorage.getItem(k) } catch {}
    }
    return out
  })
  fs.writeFileSync(path.join(OUT, 'localStorage.json'), JSON.stringify(storage, null, 2))

  const token = storage.token || storage.Token || storage.accessToken
    || Object.values(storage).find(v => typeof v === 'string' && v.length > 32 && /^[A-Za-z0-9._-]+$/.test(v))

  // 4. 从页面提取 API base
  const apiBase = await page.evaluate(() => {
    try {
      return window.$nuxt?.$checkLine?.getApiBaseUrl?.() || ''
    } catch { return '' }
  }).catch(() => '')

  console.log('🔑 API Base:', apiBase || '(从网络拦截获取)')
  console.log('🔑 Token:', token ? `${String(token).slice(0, 20)}...` : '未找到')

  // 5. 爬取静态 JS 中的 GIF 引用
  const jsFiles = [
    `/app/${APP_VER}/app-572ae2c.js`,
    `/app/${APP_VER}/commons-2fafbd3.js`,
    `/app/${APP_VER}/pages/appcenter/index-ffe9b61.js`,
    `/app/${APP_VER}/7414eaa.js`,
  ]
  for (const js of jsFiles) {
    await downloadFile(page, `${SITE}${js}`, 'js')
  }

  // 从已下载 JS 提取 gif 路径
  const jsDir = path.join(OUT, 'js')
  if (fs.existsSync(jsDir)) {
    for (const f of fs.readdirSync(jsDir)) {
      const content = fs.readFileSync(path.join(jsDir, f), 'utf8')
      const gifs = content.match(/[\w/.-]+\.gif/g) || []
      for (const g of [...new Set(gifs)]) {
        const gifUrl = g.startsWith('http') ? g : `${SITE}/app/${APP_VER}/${g.replace(/^\//, '')}`
        await downloadFile(page, gifUrl, 'gifs')
      }
    }
  }

  // 6. 用 token 递归请求已知 API 路径
  const apiHosts = [...new Set(
    apiTree.requests
      .map(r => r.url.match(/^(https?:\/\/[^/]+\/api\/v1)/)?.[1])
      .filter(Boolean)
  )]
  if (apiHosts.length === 0) {
    apiHosts.push(
      'https://4p3kb.et8h6.cc/api/v1',
      'https://deuwy.jcd9nw.com/api/v1',
      'https://douyin-api.yah96.com/api/v1',
    )
  }

  const headers = {
    'User-Agent': UA,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: token, token } : {}),
  }

  console.log(`📡 递归请求 ${KNOWN_PATHS.length || 0} 个已知端点...`)

  // 先从 extract-paths 生成 endpoints.txt
  if (KNOWN_PATHS.length === 0) {
    const epFile = path.join(__dirname, 'endpoints.txt')
    if (!fs.existsSync(epFile)) {
      console.log('⚠ endpoints.txt 不存在，跳过 API 递归')
    }
  }

  const endpoints = KNOWN_PATHS.length ? KNOWN_PATHS : (
    fs.existsSync(path.join(__dirname, 'endpoints.txt'))
      ? fs.readFileSync(path.join(__dirname, 'endpoints.txt'), 'utf8').trim().split('\n')
      : ['app/module', 'ad/all', 'users/info', 'downloadGif/gif']
  )

  for (const host of apiHosts) {
    for (const ep of endpoints) {
      const url = `${host}/${ep.replace(/^\//, '')}`
      if (visitedUrls.has(url)) continue
      visitedUrls.add(url)

      try {
        const resp = await page.request.get(url, { headers, timeout: 15000 })
        const ct = resp.headers()['content-type'] || ''
        const status = resp.status()
        let data = null
        if (ct.includes('json')) {
          data = await resp.json().catch(() => null)
          if (data) await saveApiResponse(url, status, data, ct)
        }
        apiTree.requests.push({ url, status, method: 'GET', time: Date.now() })
        process.stdout.write(status === 200 ? '.' : 'x')
      } catch {
        process.stdout.write('!')
      }
    }
    console.log()
  }

  // 7. 下载所有 pending 资源
  const pending = apiTree._pendingAssets || new Set()
  console.log(`\n📥 下载 ${pending.size} 个嵌套资源...`)
  for (const u of pending) {
    await downloadFile(page, u, isGif(u) ? 'gifs' : 'assets')
  }

  // 8. 下载 appcenter 背景图等
  const staticAssets = [
    `/app/${APP_VER}/img/appcenterBG.2398b82.jpg`,
    `/app/${APP_VER}/img/limitedtimeUnlock.f154981.gif`,
    `/app/${APP_VER}/icons/icon_512x512.de7d7b.png`,
    `/favicon.ico`,
  ]
  for (const a of staticAssets) {
    await downloadFile(page, `${SITE}${a}`, isGif(a) ? 'gifs' : 'assets')
  }

  // 9. 保存 API 树
  delete apiTree._pendingAssets
  apiTree.summary = {
    totalRequests: apiTree.requests.length,
    apiResponses: Object.keys(apiTree.responses).length,
    assets: apiTree.assets.length,
    gifs: apiTree.gifs.length,
    apiHosts,
    tokenFound: !!token,
  }

  fs.writeFileSync(path.join(OUT, 'api-tree.json'), JSON.stringify(apiTree, null, 2))

  // 生成层级索引
  const hierarchy = buildHierarchy(apiTree)
  fs.writeFileSync(path.join(OUT, 'hierarchy.json'), JSON.stringify(hierarchy, null, 2))

  console.log('\n✅ 爬取完成!')
  console.log(JSON.stringify(apiTree.summary, null, 2))
  console.log(`📁 输出目录: ${OUT}`)

  await browser.close()
}

function buildHierarchy(tree) {
  const root = { name: 'root', children: [] }
  for (const [key, val] of Object.entries(tree.responses)) {
    const parts = key.split('/').filter(Boolean)
    let node = root
    for (const p of parts) {
      let child = node.children?.find(c => c.name === p)
      if (!child) {
        child = { name: p, children: [] }
        node.children = node.children || []
        node.children.push(child)
      }
      node = child
    }
    node.url = val.url
    node.file = val.file
    node.nestedUrls = val.nestedUrls?.slice(0, 20)
  }
  return root
}

main().catch(err => {
  console.error('❌ 爬虫失败:', err)
  process.exit(1)
})
