#!/usr/bin/env node
/**
 * Agent 16 — Media decrypt cover audit (featured / anime / circle)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import CryptoJS from 'crypto-js'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RES_BASE = 'https://d17e80montytxe.cloudfront.net'
const IMG_KEY = '82758dd12749c777ef579f1839ceea6a'
const CLONE = 'https://b12sl5x.cn'
const OUT = path.join(ROOT, 'crawled', 'audit-16-media-covers.json')

function localComicCover(p) {
  const clean = String(p || '').split('@')[0].replace(/^\/+/, '')
  // also strip CDN prefix if present
  const rel = clean.replace(/^https?:\/\/[^/]+\//i, '')
  const m = rel.match(/^comics\/oldDriver\/([^/]+)\/(cover_[^/?#]+)$/i)
  if (m) return `/comics/comics_oldDriver_${m[1]}_${m[2]}`
  return ''
}

function mediaUrl(p) {
  if (!p) return ''
  const clean = String(p).split('@')[0]
  if (/^(https?:|data:|blob:|\/)/i.test(clean)) return clean
  return `${RES_BASE}/${clean.replace(/^\/+/, '')}`
}

function isEncrypted(p) {
  return /\.(ceb|geb)(\?|$)/i.test(String(p || '').split('@')[0])
}

function toWordArray(u8) {
  const words = []
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      ((u8[i] || 0) << 24) |
        ((u8[i + 1] || 0) << 16) |
        ((u8[i + 2] || 0) << 8) |
        (u8[i + 3] || 0),
    )
  }
  return CryptoJS.lib.WordArray.create(words, u8.length)
}

function decryptToDataUrl(u8) {
  const k = CryptoJS.enc.Utf8.parse(IMG_KEY)
  const dec = CryptoJS.AES.decrypt({ ciphertext: toWordArray(u8) }, k, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })
  const text = CryptoJS.enc.Utf8.stringify(dec)
  return text.startsWith('data:image/') ? text : ''
}

async function probePath(raw, label) {
  const result = {
    label,
    path: String(raw || '').slice(0, 180),
    kind: 'empty',
    ok: false,
    via: '',
    err: '',
    bytes: 0,
    mimeHead: '',
  }
  if (!raw) {
    result.err = 'empty path'
    return result
  }
  if (/^(data:|blob:)/i.test(raw)) {
    result.kind = 'inline'
    result.ok = true
    result.via = 'inline'
    return result
  }

  const mapped = localComicCover(raw)
  if (mapped) {
    const fp = path.join(ROOT, 'public', mapped.replace(/^\//, ''))
    const exists = fs.existsSync(fp)
    result.kind = 'localComic'
    result.via = mapped
    result.ok = exists
    if (!exists) result.err = 'local map miss (file absent)'
    else result.bytes = fs.statSync(fp).size
    return result
  }

  if (!isEncrypted(raw) && /\.(gif|png|jpe?g|webp)(\?|$)/i.test(raw)) {
    const url = mediaUrl(raw)
    result.kind = 'plain'
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      result.ok = res.ok
      result.via = url.slice(0, 120)
      result.bytes = Number(res.headers.get('content-length') || 0)
      if (!res.ok) result.err = `http ${res.status}`
    } catch (e) {
      result.err = String(e.message || e)
    }
    return result
  }

  if (!isEncrypted(raw)) {
    result.kind = 'other'
    result.via = mediaUrl(raw).slice(0, 120)
    result.ok = true
    result.err = 'non-encrypted passthrough'
    return result
  }

  result.kind = 'encrypted'
  const url = mediaUrl(raw)
  result.via = url.slice(0, 140)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) })
    if (!res.ok) {
      result.err = `http ${res.status}`
      return result
    }
    const u8 = new Uint8Array(await res.arrayBuffer())
    result.bytes = u8.length
    const dataUrl = decryptToDataUrl(u8)
    if (!dataUrl) {
      result.err = 'decrypt failed (no data:image)'
      return result
    }
    result.ok = true
    result.mimeHead = dataUrl.slice(0, 32)
  } catch (e) {
    result.err = String(e.message || e)
  }
  return result
}

function walkCovers(obj, bag, page) {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const x of obj) walkCovers(x, bag, page)
    return
  }
  const keys = [
    'cover',
    'coverURL',
    'coverUrl',
    'verticalCoverURL',
    'horizontalCoverUrl',
    'coverLocal',
    'avatarURL',
    'imgUrl',
  ]
  for (const k of keys) {
    if (typeof obj[k] === 'string' && obj[k]) {
      bag.push({ page, field: k, path: obj[k], title: obj.name || obj.title || '' })
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') walkCovers(v, bag, page)
  }
}

function uniqByPath(items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    const key = String(it.path).split('@')[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

async function pagePlaceholderAudit(browser, hash, pageName) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const url = `${CLONE}/#/${hash}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(6000)
    // dismiss popup if any
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, .close, [class*="close"]')]
      for (const b of btns) {
        const t = (b.textContent || '').trim()
        if (t === '×' || t === 'X' || /关闭|跳过/.test(t)) b.click()
      }
    }).catch(() => {})
    await page.waitForTimeout(2500)

    const stats = await page.evaluate(() => {
      const wraps = [...document.querySelectorAll('.ceb-wrap')]
      const ph = wraps.filter((w) => w.querySelector('.ceb-ph') && !w.querySelector('img.ceb-img'))
      const imgs = wraps.filter((w) => w.querySelector('img.ceb-img'))
      const brokenImgs = [...document.querySelectorAll('img')].filter((img) => {
        if (!img.src || img.src.startsWith('data:')) return false
        return !img.complete || img.naturalWidth === 0
      })
      const grayish = wraps.filter((w) => {
        const el = w.querySelector('.ceb-ph, .ceb-img') || w
        const bg = getComputedStyle(el).backgroundImage || ''
        return bg.includes('gradient') && !w.querySelector('img.ceb-img')
      })
      return {
        cebWraps: wraps.length,
        withImg: imgs.length,
        blankPh: ph.length,
        grayPlaceholders: grayish.length,
        brokenPlainImgs: brokenImgs.length,
        sampleBlankRects: ph.slice(0, 5).map((el) => {
          const r = el.getBoundingClientRect()
          return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }
        }),
      }
    })
    return { page: pageName, url, ...stats }
  } catch (e) {
    return { page: pageName, url, err: String(e.message || e) }
  } finally {
    await context.close()
  }
}

// --- collect sources ---
const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/live-api.json'), 'utf8'))
const comics = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/circle-comics.json'), 'utf8'))
const feeds = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/feeds.json'), 'utf8'))

const bag = []
// featured-ish from live-api
walkCovers(live.videosRecommend || live.recommend || {}, bag, 'featured')
walkCovers(live.algoRecommend || live.getList || {}, bag, 'featured')
walkCovers(live.homeRecommend || {}, bag, 'featured')
// common live-api shapes
for (const [k, v] of Object.entries(live)) {
  if (/video|recommend|algo|feature|list/i.test(k)) walkCovers(v, bag, 'featured')
  if (/comic|anime|vip/i.test(k)) walkCovers(v, bag, 'anime')
  if (/circle|topic|group|post/i.test(k)) walkCovers(v, bag, 'circle')
}
walkCovers(comics, bag, 'anime')
walkCovers(feeds.featured || {}, bag, 'featured')
walkCovers(feeds.anime || {}, bag, 'anime')
walkCovers(feeds.circle || {}, bag, 'circle')

const unique = uniqByPath(bag)
const encrypted = unique.filter((x) => isEncrypted(x.path))
const comicPaths = unique.filter((x) => /comics\/oldDriver/i.test(x.path) || localComicCover(x.path))

console.log(`Collected ${unique.length} unique covers; encrypted=${encrypted.length}; comicMapped=${comicPaths.length}`)

// probe encrypted (cap 80) + all comic maps + sample plain
const toProbe = [
  ...encrypted.slice(0, 80),
  ...comicPaths.filter((x) => !isEncrypted(x.path)),
].filter((x, i, a) => a.findIndex((y) => y.path === x.path) === i)

const results = []
for (const item of toProbe) {
  const r = await probePath(item.path, `${item.page}:${item.field}`)
  r.title = String(item.title || '').slice(0, 40)
  r.page = item.page
  results.push(r)
  const mark = r.ok ? 'OK' : 'FAIL'
  console.log(`[${mark}] ${r.kind} ${r.page} ${r.path.slice(0, 70)} ${r.err || r.via}`)
}

const byPage = {}
for (const p of ['featured', 'anime', 'circle']) {
  const rows = results.filter((r) => r.page === p)
  const enc = rows.filter((r) => r.kind === 'encrypted')
  const fail = rows.filter((r) => !r.ok)
  byPage[p] = {
    probed: rows.length,
    encrypted: enc.length,
    encOk: enc.filter((r) => r.ok).length,
    encFail: enc.filter((r) => !r.ok).length,
    fail: fail.length,
    failRate: rows.length ? +(fail.length / rows.length).toFixed(4) : null,
    encFailRate: enc.length ? +(enc.filter((r) => !r.ok).length / enc.length).toFixed(4) : null,
  }
}

const encAll = results.filter((r) => r.kind === 'encrypted')
const encFail = encAll.filter((r) => !r.ok)
const localComic = results.filter((r) => r.kind === 'localComic')
const localMiss = localComic.filter((r) => !r.ok)

const publicComics = fs.readdirSync(path.join(ROOT, 'public/comics')).filter((f) => !f.startsWith('.'))
const expectedMaps = comicPaths.map((c) => ({
  path: c.path,
  mapped: localComicCover(c.path),
  exists: (() => {
    const m = localComicCover(c.path)
    return m ? fs.existsSync(path.join(ROOT, 'public', m.replace(/^\//, ''))) : false
  })(),
}))

let ui = {}
try {
  const browser = await chromium.launch({ headless: true })
  ui = {
    featured: await pagePlaceholderAudit(browser, 'videosPage', 'featured'),
    anime: await pagePlaceholderAudit(browser, 'vipPage', 'anime'),
    circle: await pagePlaceholderAudit(browser, 'circle', 'circle'),
  }
  await browser.close()
} catch (e) {
  ui = { err: String(e.message || e) }
}

const report = {
  at: new Date().toISOString(),
  agent: '16/20 media-decrypt-covers',
  summary: {
    uniqueCoversCollected: unique.length,
    probed: results.length,
    encryptedProbed: encAll.length,
    encryptedOk: encAll.filter((r) => r.ok).length,
    encryptedFail: encFail.length,
    encFailRate: encAll.length ? +(encFail.length / encAll.length).toFixed(4) : null,
    overallFailRate: results.length
      ? +(results.filter((r) => !r.ok).length / results.length).toFixed(4)
      : null,
    localComicMapped: localComic.length,
    localComicMiss: localMiss.length,
    publicComicsFiles: publicComics.length,
  },
  byPage,
  publicComics,
  localMapAudit: {
    expectedUnique: expectedMaps.length,
    hit: expectedMaps.filter((x) => x.exists).length,
    miss: expectedMaps.filter((x) => x.mapped && !x.exists).length,
    missSamples: expectedMaps.filter((x) => x.mapped && !x.exists).slice(0, 10),
    note: 'media.js localComicCover does not verify file exists; missing → CebImg gray .ceb-ph',
  },
  codeNotes: [
    'CebImg shows .ceb-ph gray gradient when decryptMedia throws or path empty or img @error',
    'normalizeVideo/Comic wrap covers with CDN mediaUrl BEFORE CebImg — localComicCover regex only matches relative comics/oldDriver/... so LIVE full-URL comic covers SKIP local map',
    'CirclePage does NOT use CebImg — plain <img> with /circle/* locals or raw CDN URLs; .ceb group covers would break as binary',
  ],
  brokenSamples: results
    .filter((r) => !r.ok)
    .slice(0, 25)
    .map((r) => ({
      page: r.page,
      kind: r.kind,
      path: r.path,
      err: r.err,
      title: r.title,
    })),
  uiPlaceholders: ui,
  okSamples: results
    .filter((r) => r.ok && r.kind === 'encrypted')
    .slice(0, 5)
    .map((r) => ({ path: r.path, mimeHead: r.mimeHead, bytes: r.bytes })),
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(report.summary, null, 2))
console.log('byPage', JSON.stringify(byPage, null, 2))
console.log('uiPlaceholders', JSON.stringify(ui, null, 2))
console.log('broken', report.brokenSamples.length)
console.log('Wrote', OUT)
