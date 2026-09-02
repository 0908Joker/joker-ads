#!/usr/bin/env node
/** Re-probe one play id + origin chrome + live sample via decrypted proxy lists */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
import CryptoJS from 'crypto-js'
import { inflate, ungzip } from 'pako'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROXY = 'https://al-ads.com/api-proxy'
const CLONE = 'https://b12sl5x.cn'
const ORIGIN = 'https://fbi.xdx794.com'
const ID = process.argv[2] || '69dc60250ae0c316723e0f52'
const session = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/api-session.json'), 'utf8'))
const KEY = 'tL3LkTOEouYphOPB94wJpbtEEUHJ4hI5'

function decompressToText(raw) {
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? ungzip(raw) : inflate(raw)
  return new TextDecoder('utf-8').decode(bytes)
}

function decryptCipher(cipher) {
  const k = CryptoJS.enc.Utf8.parse(KEY)
  const dec = CryptoJS.AES.decrypt(cipher, k, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 })
  let b64text = ''
  try { b64text = CryptoJS.enc.Utf8.stringify(dec) } catch { b64text = CryptoJS.enc.Latin1.stringify(dec) }
  const raw = Uint8Array.from(atob(b64text), (c) => c.charCodeAt(0))
  return JSON.parse(decompressToText(raw))
}

async function api(p) {
  const url = `${PROXY}${p}${p.includes('?') ? '&' : '?'}pid=FBI`
  const res = await fetch(url, { headers: { Accept: 'application/json', t: '3', k: '3', token: session.token || '' } })
  const j = await res.json()
  const data = typeof j.data === 'string' ? decryptCipher(j.data) : j.data
  return { status: res.status, errorCode: j.errorCode, data }
}

function pickIds(data, n = 8) {
  const list = data?.videoInfo || data?.list || data?.videos || data?.rows || []
  const ids = []
  for (const it of list) {
    const v = it.video || it
    const id = v.id || v._id || it.id
    if (id) ids.push({ id: String(id), title: (v.name || v.title || '').slice(0, 60) })
    if (ids.length >= n) break
  }
  return ids
}

const recommend = await api('/videos/recommend?page=1&pageSize=12')
const short = await api('/videos/shortAndImg?page=1&pageSize=10')
const liveFeatured = pickIds(recommend.data, 6)
const liveShort = pickIds(short.data, 6)
console.log(JSON.stringify({
  recommend: { status: recommend.status, errorCode: recommend.errorCode, n: liveFeatured.length },
  short: { status: short.status, errorCode: short.errorCode, n: liveShort.length },
  liveFeatured,
  liveShort,
}, null, 2))

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
await ctx.addInitScript((t) => { try { localStorage.setItem('token', t) } catch {} }, session.token)

async function probePlay(id) {
  const page = await ctx.newPage()
  const net = { detail: null, m3u8: [], banned: [], proxyHits: 0 }
  page.on('response', async (res) => {
    const u = res.url()
    if (/al-ads\.com/i.test(u)) net.proxyHits++
    if (/deuwy\.jcd9nw|et8h6\.cc|34\.92\.209\.217|180\.188\.198\.189/i.test(u) && /(api|m3u8|\.ts)/i.test(u)) {
      net.banned.push(u.split('?')[0])
    }
    if (/\/videos\/[a-f0-9]+(\?|$)/i.test(u) && !/m3u8|\.ts/i.test(u)) {
      try {
        const j = await res.json()
        net.detail = { status: res.status(), errorCode: j.errorCode, via: /al-ads/.test(u) ? 'proxy' : 'other' }
      } catch {}
    }
    if (/\.m3u8(\?|$)/i.test(u)) net.m3u8.push({ status: res.status(), via: /al-ads/.test(u) ? 'proxy' : 'other' })
  })
  await page.goto(`${CLONE}/#/play/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  let snap = null
  for (let i = 0; i < 28; i++) {
    snap = await page.evaluate(() => {
      const v = document.querySelector('video')
      return {
        readyState: v?.readyState ?? -1,
        error: v?.error?.code ?? null,
        status: document.querySelector('.play__status')?.textContent || '',
        w: v?.videoWidth,
        h: v?.videoHeight,
        chrome: {
          hasBack: !!document.querySelector('.play__back'),
          hasControls: !!v?.controls,
          barTitle: document.querySelector('.play__bar-title')?.textContent?.trim()?.slice(0, 40) || '',
          tags: [...document.querySelectorAll('.play__tags span')].length,
          more: !!document.querySelector('.play__more'),
        },
      }
    })
    if (snap.readyState >= 2) break
    await page.waitForTimeout(1500)
  }
  await page.close()
  const ok =
    snap.readyState >= 2 &&
    net.detail?.errorCode === 0 &&
    net.detail?.via === 'proxy' &&
    net.m3u8.some((m) => m.status === 200 && m.via === 'proxy') &&
    net.banned.length === 0
  return { id, ok, snap, net }
}

const retry = await probePlay(ID)
console.log('RETRY', JSON.stringify(retry, null, 2))

// Extra live ids (2 featured + 2 short) smoke
const extras = [...liveFeatured.slice(0, 2), ...liveShort.slice(0, 2)]
const extraResults = []
for (const s of extras) {
  if (s.id === ID) continue
  const r = await probePlay(s.id)
  extraResults.push({ id: s.id, title: s.title, ok: r.ok, readyState: r.snap.readyState, detail: r.net.detail, m3u8: r.net.m3u8 })
  console.log('EXTRA', s.id, r.ok ? 'PASS' : 'FAIL', r.snap.readyState)
}

const op = await ctx.newPage()
let origin = {}
try {
  await op.goto(`${ORIGIN}/#/play/${ID}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await op.waitForTimeout(5000)
  origin = await op.evaluate(() => ({
    url: location.href,
    text: (document.body?.innerText || '').slice(0, 400),
    hasVideo: !!document.querySelector('video'),
    readyState: document.querySelector('video')?.readyState ?? null,
  }))
} catch (e) {
  origin = { error: e.message }
}
console.log('ORIGIN', JSON.stringify(origin, null, 2))
await browser.close()

const out = { retry, extras: extraResults, origin, liveFeatured, liveShort }
fs.writeFileSync(path.join(ROOT, 'crawled', 'audit-08-playback-retry.json'), JSON.stringify(out, null, 2))
