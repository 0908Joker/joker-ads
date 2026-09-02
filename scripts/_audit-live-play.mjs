#!/usr/bin/env node
/**
 * Playback audit v2 — sample ≥8 live IDs from featured+short via decrypted proxy,
 * open #/play/:id, require readyState≥2, al-ads only (host-based), errorCode 0, m3u8 200.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'
import CryptoJS from 'crypto-js'
import { inflate, ungzip } from 'pako'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROXY = 'https://al-ads.com/api-proxy'
const CLONE = 'https://b12sl5x.cn'
const ORIGIN = 'https://fbi.xdx794.com'
const OUT = path.join(ROOT, 'crawled', 'audit-08-playback.json')
const session = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/api-session.json'), 'utf8'))
const KEY = 'tL3LkTOEouYphOPB94wJpbtEEUHJ4hI5'
const BANNED_HOSTS = new Set([
  'deuwy.jcd9nw.com',
  '4p3kb.et8h6.cc',
  '34.92.209.217',
  '180.188.198.189',
  'fbi.xdx794.com',
])

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
  return { status: res.status, errorCode: j.errorCode, data, textLen: JSON.stringify(j).length }
}
function pickIds(data, n, from) {
  const list = data?.videoInfo || data?.list || data?.videos || data?.rows || []
  const out = []
  for (const it of list) {
    const v = it.video || it
    const id = v.id || v._id || it.id
    if (id) out.push({ id: String(id), title: (v.name || v.title || '').slice(0, 80), from })
    if (out.length >= n) break
  }
  return out
}
function hostOf(u) {
  try { return new URL(u).hostname } catch { return '' }
}
function classify(u) {
  const h = hostOf(u)
  if (h === 'al-ads.com') return 'proxy'
  if (BANNED_HOSTS.has(h)) return 'banned'
  return 'other'
}

async function checkProxyHealth() {
  const speed = await fetch(`${PROXY}/speedtest`, { headers: { t: '3', k: '3' } })
  const recommend = await api('/videos/recommend?page=1&pageSize=4')
  return {
    proxyBase: PROXY,
    speedtest: { ok: speed.ok, status: speed.status },
    recommend: { ok: recommend.status === 200, status: recommend.status, errorCode: recommend.errorCode, encrypted: true },
    healthy: speed.ok && recommend.status === 200 && recommend.errorCode === 0,
  }
}

async function auditPlay(context, sample) {
  const page = await context.newPage()
  const network = { detail: null, m3u8: [], bannedHits: [], proxyHits: 0 }
  page.on('request', (req) => {
    const u = req.url()
    if (!/\/videos\/|m3u8|\.ts(\?|$)|api-proxy|\/api\/v1\//i.test(u)) return
    const via = classify(u)
    if (via === 'banned') network.bannedHits.push(u.split('?')[0])
    if (via === 'proxy') network.proxyHits++
  })
  page.on('response', async (res) => {
    const u = res.url()
    try {
      if (/\/(?:api-proxy|api\/v1)\/videos\/[a-f0-9]+(\?|$)/i.test(u) && !/m3u8|\.ts/i.test(u)) {
        let errorCode = null, message = ''
        try { const j = await res.json(); errorCode = j.errorCode ?? null; message = j.message || '' } catch {}
        network.detail = { url: u.split('?')[0], status: res.status(), errorCode, message, via: classify(u) }
      }
      if (/\.m3u8(\?|$)/i.test(u)) {
        network.m3u8.push({ url: u.split('?')[0], status: res.status(), via: classify(u) })
      }
    } catch {}
  })

  const result = {
    id: sample.id, source: sample.from, titleHint: sample.title,
    ok: false, reasons: [], readyState: null, videoError: null, statusText: '', chrome: null, network: null,
  }
  try {
    await page.goto(`${CLONE}/#/play/${sample.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(1000)
    for (let i = 0; i < 28; i++) {
      const snap = await page.evaluate(() => {
        const v = document.querySelector('.play__video, video')
        return {
          readyState: v?.readyState ?? -1,
          error: v?.error?.code ?? null,
          status: document.querySelector('.play__status')?.textContent?.trim() || '',
          title: document.querySelector('.play__meta h1, .play__bar-title')?.textContent?.trim() || '',
          hasBack: !!document.querySelector('.play__back'),
          hasControls: !!v?.controls,
          video: (() => { if (!v) return null; const r = v.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) } })(),
          tags: [...document.querySelectorAll('.play__tags span')].map((t) => t.textContent.trim()).slice(0, 6),
        }
      })
      result.readyState = snap.readyState
      result.videoError = snap.error
      result.statusText = snap.status
      result.titleHint = result.titleHint || snap.title
      result.chrome = { hasBack: snap.hasBack, hasControls: snap.hasControls, video: snap.video, tags: snap.tags, barTitle: (snap.title || '').slice(0, 40) }
      if (snap.readyState >= 2 && !snap.error) break
      if (snap.status && snap.status !== '加载中…' && /失败|未获取|不支持/.test(snap.status)) break
      await page.waitForTimeout(1500)
    }

    const ready = result.readyState >= 2 && !result.videoError
    const detailOk = network.detail?.errorCode === 0 && network.detail?.status === 200
    const detailProxy = network.detail?.via === 'proxy'
    const m3u8Ok = network.m3u8.some((m) => m.status === 200)
    const m3u8Proxy = network.m3u8.some((m) => m.status === 200 && m.via === 'proxy')
    const noBanned = network.bannedHits.length === 0

    if (!ready) result.reasons.push(`readyState=${result.readyState}${result.statusText ? ` status="${result.statusText}"` : ''}`)
    if (!network.detail) result.reasons.push('no detail API response')
    else {
      if (network.detail.errorCode !== 0) result.reasons.push(`detail errorCode=${network.detail.errorCode}`)
      if (network.detail.status !== 200) result.reasons.push(`detail HTTP ${network.detail.status}`)
      if (!detailProxy) result.reasons.push(`detail via ${network.detail.via}`)
    }
    if (!m3u8Ok) result.reasons.push(network.m3u8.length ? `m3u8 statuses=${network.m3u8.map((m) => m.status)}` : 'no m3u8')
    else if (!m3u8Proxy) result.reasons.push('m3u8 not via al-ads')
    if (!noBanned) result.reasons.push(`banned host hits: ${[...new Set(network.bannedHits)].slice(0, 3).join(' | ')}`)

    result.ok = ready && detailOk && detailProxy && m3u8Ok && m3u8Proxy && noBanned
    result.network = {
      detail: network.detail,
      m3u8: network.m3u8.slice(0, 4),
      bannedHits: [...new Set(network.bannedHits)].slice(0, 6),
      proxyHitCount: network.proxyHits,
    }
  } catch (e) {
    result.reasons.push(`exception: ${e.message}`)
  } finally {
    await page.close().catch(() => {})
  }
  return result
}

async function originCompare(context, id) {
  const page = await context.newPage()
  try {
    await page.goto(`${ORIGIN}/#/play/${id}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(4000)
    const info = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 240),
      hasVideo: !!document.querySelector('video'),
    }))
    const blocked = /#\/launch/.test(info.url) || /禁止登陆|封禁|验证/.test(info.text)
    return { reachable: !blocked, blocked, finalUrl: info.url, note: blocked ? 'origin IP banned → #/launch' : 'ok', snippet: info.text.slice(0, 120) }
  } catch (e) {
    return { reachable: false, blocked: true, error: e.message }
  } finally {
    await page.close().catch(() => {})
  }
}

const proxyHealth = await checkProxyHealth()
console.log('proxy', JSON.stringify(proxyHealth))

const recommend = await api('/videos/recommend?page=1&pageSize=12')
const short = await api('/videos/shortAndImg?page=1&pageSize=10')
const samples = [
  ...pickIds(recommend.data, 5, 'featured-live'),
  ...pickIds(short.data, 5, 'short-live'),
]
console.log('samples', samples.length, samples.map((s) => s.id))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
await context.addInitScript((t) => { try { localStorage.setItem('token', t) } catch {} }, session.token)

const results = []
for (const s of samples) {
  process.stdout.write(`${s.from} ${s.id} ... `)
  const r = await auditPlay(context, s)
  results.push(r)
  console.log(r.ok ? 'PASS' : `FAIL [${r.reasons.join('; ')}]`)
}

const originPlayerCompare = await originCompare(context, samples[0]?.id)
await browser.close()

const passed = results.filter((r) => r.ok)
const failed = results.filter((r) => !r.ok)
const report = {
  agent: '08/20',
  at: new Date().toISOString(),
  clone: CLONE,
  origin: ORIGIN,
  proxy: PROXY,
  proxyHealth,
  sample: { ids: samples.map((s) => s.id), samples },
  playChecked: results.length,
  playOk: passed.length,
  playFailed: failed.length,
  passRate: `${passed.length}/${results.length}`,
  results,
  failures: failed.map((f) => ({
    id: f.id,
    source: f.source,
    readyState: f.readyState,
    reasons: f.reasons,
    detail: f.network?.detail || null,
    m3u8: f.network?.m3u8 || [],
  })),
  originPlayerCompare,
  chromeNote: 'Clone PlayPage: back bar + controls video + meta/tags. Origin play unreachable (IP banned → #/launch).',
  verdict: failed.length === 0 && proxyHealth.healthy ? 'PASS' : 'FAIL',
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log('\n=== AUDIT 08 PLAYBACK ===')
console.log(JSON.stringify({
  passRate: report.passRate,
  verdict: report.verdict,
  proxyHealthy: proxyHealth.healthy,
  failures: report.failures,
  originReachable: originPlayerCompare.reachable,
}, null, 2))
console.log('wrote', OUT)
