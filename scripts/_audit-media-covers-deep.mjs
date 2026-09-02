#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import CryptoJS from 'crypto-js'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RES = 'https://d17e80montytxe.cloudfront.net'
const KEY = '82758dd12749c777ef579f1839ceea6a'
const CLONE = 'https://b12sl5x.cn'

function toWA(u8) {
  const w = []
  for (let i = 0; i < u8.length; i += 4) {
    w.push(
      ((u8[i] || 0) << 24) |
        ((u8[i + 1] || 0) << 16) |
        ((u8[i + 2] || 0) << 8) |
        (u8[i + 3] || 0),
    )
  }
  return CryptoJS.lib.WordArray.create(w, u8.length)
}

function decrypt(u8) {
  const k = CryptoJS.enc.Utf8.parse(KEY)
  const t = CryptoJS.enc.Utf8.stringify(
    CryptoJS.AES.decrypt({ ciphertext: toWA(u8) }, k, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    }),
  )
  return t.startsWith('data:image/') ? t : ''
}

function stripHost(p) {
  return String(p || '').replace(/^https?:\/\/[^/]+\//i, '').replace(/^\/+/, '')
}

async function probeCover(cover) {
  if (!cover) return { ok: false, err: 'empty' }
  const rel = stripHost(cover)
  const local = rel.match(/^comics\/oldDriver\/([^/]+)\/(cover_[^/?#]+)$/i)
  if (local) {
    const fp = path.join(
      ROOT,
      'public/comics',
      `comics_oldDriver_${local[1]}_${local[2]}`,
    )
    return { kind: 'local', ok: fs.existsSync(fp), via: fp }
  }
  if (/\.(ceb|geb)(\?|$)/i.test(cover)) {
    const url = /^https?:/i.test(cover) ? cover : `${RES}/${rel}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) return { kind: 'ceb', ok: false, err: `http ${res.status}`, url }
      const u8 = new Uint8Array(await res.arrayBuffer())
      const d = decrypt(u8)
      return { kind: 'ceb', ok: !!d, err: d ? '' : 'decrypt fail', bytes: u8.length, url }
    } catch (e) {
      return { kind: 'ceb', ok: false, err: String(e.message || e) }
    }
  }
  return { kind: 'plain', ok: true, via: cover.slice(0, 100) }
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  viewport: { width: 390, height: 844 },
})
const page = await ctx.newPage()

async function scrape(hash) {
  await page.goto(`${CLONE}/#/${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(7000)
  await page
    .evaluate(() => {
      for (const b of document.querySelectorAll('button, [class*=close]')) {
        const t = (b.textContent || '').trim()
        if (t === '×' || /关闭/.test(t)) b.click()
      }
    })
    .catch(() => {})
  await page.waitForTimeout(2500)
  return page.evaluate(() => {
    const ceb = [...document.querySelectorAll('.ceb-wrap')].map((w, i) => {
      const img = w.querySelector('img.ceb-img')
      const ph = w.querySelector('.ceb-ph')
      const parent = w.closest('.comic-card, .video-row, .result-row') || w.parentElement
      const title = (
        parent?.querySelector('h4, .video-row__title, strong')?.textContent || ''
      )
        .trim()
        .slice(0, 48)
      return { i, hasImg: !!img, blank: !!ph && !img, title, src: (img?.currentSrc || '').slice(0, 60) }
    })
    const plainImgs = [
      ...document.querySelectorAll('.group-item__bg, .topic-card__bg, .post-imgs img'),
    ].map((img) => {
      const src = img.getAttribute('src') || ''
      return {
        src: src.slice(0, 180),
        nw: img.naturalWidth,
        broken: img.complete && img.naturalWidth === 0,
        isCeb: /\.(ceb|geb)(\?|$)/i.test(src.split('@')[0]),
      }
    })
    return { ceb, plainImgs }
  })
}

const featured = await scrape('videosPage')
const anime = await scrape('vipPage')
const circle = await scrape('circle')

const comics = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/circle-comics.json'), 'utf8'),
)
const all = []
function walk(o) {
  if (!o || typeof o !== 'object') return
  if (Array.isArray(o)) return o.forEach(walk)
  if (o.cover || o.coverURL || o.coverLocal) {
    all.push({
      title: o.title || o.name || '',
      cover: o.coverLocal || o.cover || o.coverURL || '',
    })
  }
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
}
walk(comics)

const blankCards = anime.ceb.filter((c) => c.blank)
const probes = []
for (const c of blankCards) {
  const hit = all.find(
    (x) =>
      (x.title && c.title && (x.title.includes(c.title) || c.title.includes(x.title))) ||
      false,
  )
  const cover = hit?.cover || null
  const p = await probeCover(cover)
  probes.push({ title: c.title, cover, ...p })
}

// Also probe ALL anime unique covers from baked
const animeAll = []
const seen = new Set()
for (const a of all) {
  const key = stripHost(a.cover)
  if (!key || seen.has(key)) continue
  seen.add(key)
  animeAll.push({ title: a.title, cover: a.cover, ...(await probeCover(a.cover)) })
}

const out = {
  at: new Date().toISOString(),
  featured: {
    ceb: featured.ceb.length,
    blank: featured.ceb.filter((c) => c.blank).length,
    withImg: featured.ceb.filter((c) => c.hasImg).length,
  },
  anime: {
    ceb: anime.ceb.length,
    blank: anime.ceb.filter((c) => c.blank).length,
    withImg: anime.ceb.filter((c) => c.hasImg).length,
    blankCards,
    blankProbes: probes,
    allBakedCoverProbe: {
      total: animeAll.length,
      ok: animeAll.filter((x) => x.ok).length,
      fail: animeAll.filter((x) => !x.ok).length,
      failRate: animeAll.length
        ? +(animeAll.filter((x) => !x.ok).length / animeAll.length).toFixed(4)
        : null,
      fails: animeAll.filter((x) => !x.ok),
      oks: animeAll.filter((x) => x.ok).map((x) => ({ title: x.title, kind: x.kind, cover: x.cover })),
    },
  },
  circle: {
    plainImgs: circle.plainImgs.length,
    broken: circle.plainImgs.filter((i) => i.broken).length,
    cebLike: circle.plainImgs.filter((i) => i.isCeb).length,
    samples: circle.plainImgs.slice(0, 15),
    brokenSamples: circle.plainImgs.filter((i) => i.broken || i.isCeb).slice(0, 15),
    note: 'CirclePage uses plain <img>, not CebImg — encrypted CDN covers would show broken',
  },
}

const outPath = path.join(ROOT, 'crawled/audit-16-media-covers-deep.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
await browser.close()
