#!/usr/bin/env node
/** Capture live anime cover paths from clone API + UI blank rate */
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

async function probe(raw) {
  if (!raw) return { ok: false, err: 'empty' }
  const rel = String(raw).replace(/^https?:\/\/[^/]+\//i, '').replace(/^\/+/, '').split('@')[0]
  const local = rel.match(/^comics\/oldDriver\/([^/]+)\/(cover_[^/?#]+)$/i)
  if (local) {
    const fp = path.join(ROOT, 'public/comics', `comics_oldDriver_${local[1]}_${local[2]}`)
    return { kind: 'local', ok: fs.existsSync(fp), path: rel }
  }
  if (/\.(ceb|geb)(\?|$)/i.test(rel)) {
    const url = `${RES}/${rel}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) return { kind: 'ceb', ok: false, err: `http ${res.status}`, path: rel }
      const u8 = new Uint8Array(await res.arrayBuffer())
      const d = decrypt(u8)
      return { kind: 'ceb', ok: !!d, err: d ? '' : 'decrypt fail', path: rel, bytes: u8.length }
    } catch (e) {
      return { kind: 'ceb', ok: false, err: String(e.message || e), path: rel }
    }
  }
  return { kind: 'plain', ok: true, path: rel }
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  viewport: { width: 390, height: 844 },
})
const page = await ctx.newPage()
const apiCovers = []

page.on('response', async (res) => {
  try {
    const u = res.url()
    if (!/comics\//i.test(u) && !/getHomeComic|getComicList|getPreview/i.test(u)) return
    if (res.status() !== 200) return
    const ct = res.headers()['content-type'] || ''
    if (!/json/i.test(ct)) return
    const json = await res.json().catch(() => null)
    if (!json) return
    const bag = []
    const walk = (o) => {
      if (!o || typeof o !== 'object') return
      if (Array.isArray(o)) return o.forEach(walk)
      const title = o.name || o.title || ''
      const cover = o.coverURL || o.horizontalCoverUrl || o.cover || o.coverLocal || ''
      if (cover && title) bag.push({ title: String(title).slice(0, 60), cover, api: u.slice(0, 120) })
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
    }
    walk(json)
    apiCovers.push(...bag)
  } catch {}
})

await page.goto(`${CLONE}/#/vipPage`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(9000)

const ui = await page.evaluate(() => {
  return [...document.querySelectorAll('.ceb-wrap')].map((w) => {
    const img = w.querySelector('img.ceb-img')
    const parent = w.closest('.comic-card')
    return {
      title: (parent?.querySelector('h4')?.textContent || '').trim().slice(0, 60),
      blank: !img,
      src: (img?.currentSrc || '').slice(0, 80),
    }
  })
})

// unique api covers
const seen = new Set()
const unique = []
for (const c of apiCovers) {
  const key = `${c.title}|${c.cover}`
  if (seen.has(key)) continue
  seen.add(key)
  unique.push(c)
}

const probes = []
for (const c of unique.slice(0, 40)) {
  probes.push({ title: c.title, cover: c.cover, ...(await probe(c.cover)) })
}

const blankUi = ui.filter((x) => x.blank)
const matched = blankUi.map((b) => {
  const hit = unique.find(
    (u) => u.title === b.title || u.title.includes(b.title) || b.title.includes(u.title),
  )
  return { title: b.title, cover: hit?.cover || null }
})

for (const m of matched) {
  if (m.cover) Object.assign(m, await probe(m.cover))
  else Object.assign(m, { ok: false, err: 'no api cover matched' })
}

const out = {
  at: new Date().toISOString(),
  ui: { total: ui.length, blank: blankUi.length, blankRate: ui.length ? +(blankUi.length / ui.length).toFixed(4) : null, cards: ui },
  apiCoversUnique: unique.length,
  apiProbe: {
    total: probes.length,
    ok: probes.filter((p) => p.ok).length,
    fail: probes.filter((p) => !p.ok).length,
    failRate: probes.length ? +(probes.filter((p) => !p.ok).length / probes.length).toFixed(4) : null,
    fails: probes.filter((p) => !p.ok).slice(0, 20),
    okSamples: probes.filter((p) => p.ok).slice(0, 8),
  },
  blankMatched: matched,
}
fs.writeFileSync(path.join(ROOT, 'crawled/audit-16-anime-live-covers.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
await browser.close()
