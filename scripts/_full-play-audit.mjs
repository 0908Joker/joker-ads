import { readFileSync, writeFileSync } from 'fs'
import CryptoJS from 'crypto-js'
import { inflate, ungzip } from 'pako'

const RES = 'https://d17e80montytxe.cloudfront.net'
const PROXY = 'https://al-ads.com/api-proxy'
const session = JSON.parse(readFileSync('./src/data/api-session.json', 'utf8'))
const cats = JSON.parse(readFileSync('./src/data/short-categories.json', 'utf8')).categories
const KEY = 'tL3LkTOEouYphOPB94wJpbtEEUHJ4hI5'

function decompressToText(raw) {
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? ungzip(raw) : inflate(raw)
  return new TextDecoder('utf-8').decode(bytes)
}
function decryptCipher(cipher) {
  const k = CryptoJS.enc.Utf8.parse(KEY)
  const dec = CryptoJS.AES.decrypt(cipher, k, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 })
  let b64 = ''
  try { b64 = CryptoJS.enc.Utf8.stringify(dec) } catch { b64 = CryptoJS.enc.Latin1.stringify(dec) }
  if (!b64) return null
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return JSON.parse(decompressToText(raw))
}
function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${RES}/${String(path).replace(/^\/+/, '')}`
}
function shortPlayUrl(row, video = {}) {
  const cdnHls = mediaUrl(video.playURL || '')
  if (cdnHls && /\.m3u8(\?|$)/i.test(cdnHls)) return cdnHls
  const mp4 = mediaUrl(video.mp4PlayURL || video.videoUrl || '')
  if (mp4 && !/\/web\/files\//i.test(mp4)) return mp4
  const apiHls = row?.url || row?.previewUrl || ''
  if (apiHls) return apiHls
  return mp4 || ''
}
async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return { status: r.status, ct: r.headers.get('content-type') || '' }
  } catch (e) {
    return { status: 0, err: String(e.message || e) }
  }
}
async function getText(url) {
  try {
    const r = await fetch(url)
    const t = await r.text()
    return { status: r.status, ct: r.headers.get('content-type') || '', head: t.slice(0, 80).replace(/\n/g, '|') }
  } catch (e) {
    return { status: 0, err: String(e.message || e) }
  }
}

const headers = { Accept: 'application/json', t: '3', k: '3', token: session.token }
const st = await fetch(`${PROXY}/speedtest?pid=FBI`, { headers })
const stj = await st.json()
headers.sid = stj.sid

const report = { at: new Date().toISOString(), shortTabs: [], playSamples: [], summary: {} }

// 1) All short tabs
for (const c of cats) {
  const r = await fetch(`${PROXY}/videos/short?page=1&pageSize=10&categorieId=${c.categorieId}&pid=FBI`, { headers })
  const j = await r.json()
  const data = j.errorCode === 0 ? (typeof j.data === 'string' ? decryptCipher(j.data) : j.data) : null
  const list = data?.videoInfo || []
  const rows = []
  for (const row of list) {
    const v = row.video || {}
    const play = shortPlayUrl(row, v)
    const mp4 = mediaUrl(v.mp4PlayURL || '')
    let probe = { play, kind: '' }
    if (/\.m3u8(\?|$)/i.test(play)) {
      probe.kind = 'hls'
      const g = await getText(play.startsWith('http') && play.includes('/api/v1/') ? play.replace(/^https?:\/\/[^/]+\/api\/v1/i, PROXY) : play)
      probe.status = g.status
      probe.ok = g.status === 200 && /#EXTM3U/.test(g.head || '')
      probe.head = g.head
    } else if (/\.mp4(\?|$)/i.test(play)) {
      probe.kind = 'mp4'
      const h = await head(play)
      probe.status = h.status
      probe.ok = h.status === 200
    } else {
      probe.kind = 'empty'
      probe.ok = false
      probe.status = 0
    }
    // also note dead mp4
    let mp4Status = null
    if (mp4) {
      const h = await head(mp4)
      mp4Status = h.status
    }
    rows.push({
      id: v.id,
      name: String(v.name || '').slice(0, 36),
      playOk: !!probe.ok,
      playKind: probe.kind,
      playStatus: probe.status,
      mp4Status,
      deadFilesMp4: /\/web\/files\//i.test(mp4),
    })
  }
  report.shortTabs.push({
    tab: c.name,
    categorieId: c.categorieId,
    n: list.length,
    playOk: rows.filter((x) => x.playOk).length,
    playFail: rows.filter((x) => !x.playOk).length,
    rows,
  })
}

// shortAndImg (短剧 path)
{
  const r = await fetch(`${PROXY}/videos/shortAndImg?page=1&pageSize=10&pid=FBI`, { headers })
  const j = await r.json()
  const data = j.errorCode === 0 ? (typeof j.data === 'string' ? decryptCipher(j.data) : j.data) : null
  const list = data?.videoInfo || []
  let ok = 0, fail = 0
  const fails = []
  for (const row of list) {
    const v = row.video || {}
    const play = shortPlayUrl(row, v)
    let good = false
    if (/\.m3u8(\?|$)/i.test(play)) {
      const g = await getText(play.includes('/api/v1/') ? play.replace(/^https?:\/\/[^/]+\/api\/v1/i, PROXY) : play)
      good = g.status === 200 && /#EXTM3U/.test(g.head || '')
    } else if (/\.mp4(\?|$)/i.test(play)) {
      good = (await head(play)).status === 200
    }
    if (good) ok++; else { fail++; fails.push({ id: v.id, name: String(v.name||'').slice(0,40), play: play.slice(0,100) }) }
  }
  report.shortAndImg = { n: list.length, playOk: ok, playFail: fail, fails }
}

// 2) Featured detail samples from video-pool
const pool = JSON.parse(readFileSync('./src/data/video-pool.json', 'utf8'))
const poolList = Array.isArray(pool) ? pool : (pool.videos || pool.list || [])
const ids = poolList.map((x) => x.id || x.videoId).filter(Boolean)
const sampleIds = ids.filter((_, i) => i % Math.max(1, Math.floor(ids.length / 40)) === 0).slice(0, 40)
for (const id of sampleIds) {
  const r = await fetch(`${PROXY}/videos/${id}?pid=FBI`, { headers })
  const j = await r.json()
  const data = j.errorCode === 0 ? (typeof j.data === 'string' ? decryptCipher(j.data) : j.data) : null
  const url = data?.url || data?.previewUrl || ''
  const proxied = url ? url.replace(/^https?:\/\/[^/]+\/api\/v1/i, PROXY) : ''
  let ok = false, status = 0, head = '', msg = j.message
  if (proxied) {
    const g = await getText(proxied)
    status = g.status
    head = g.head
    ok = g.status === 200 && /#EXTM3U/.test(g.head || '')
  }
  report.playSamples.push({
    id,
    errorCode: j.errorCode,
    hasUrl: !!data?.url,
    hasPreview: !!data?.previewUrl,
    buyVideo: !!data?.buyVideo,
    ok,
    status,
    head: head.slice(0, 60),
    msg,
  })
}

report.summary = {
  shortTabTotals: report.shortTabs.map((t) => ({ tab: t.tab, n: t.n, ok: t.playOk, fail: t.playFail })),
  shortAndImg: report.shortAndImg,
  playSampleOk: report.playSamples.filter((x) => x.ok).length,
  playSampleFail: report.playSamples.filter((x) => !x.ok).length,
  playBuyOnly: report.playSamples.filter((x) => x.buyVideo && !x.hasUrl && !x.hasPreview).length,
  playPreviewOnly: report.playSamples.filter((x) => !x.hasUrl && x.hasPreview).length,
  poolSize: ids.length,
  sampleSize: sampleIds.length,
}

writeFileSync('./crawled/_full-play-audit-2026-09-01.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.summary, null, 2))
