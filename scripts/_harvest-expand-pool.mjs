#!/usr/bin/env node
/**
 * Expand video-pool.json from:
 *  1) existing pool + live-api + other local JSON
 *  2) deep recommend pagination (latest/hot/recommend sorts)
 *  3) prune IDs that API says are gone (no「下架」UX — just delete)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { unwrapApiPayload } from '../src/api/decrypt.js'
import session from '../src/data/api-session.json' with { type: 'json' }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/data/video-pool.json')
const PROXY = process.env.API_PROXY || 'https://al-ads.com/api-proxy'
const MAX_PAGES = Number(process.env.MAX_PAGES || 250)
const POOL_MAX = Number(process.env.POOL_MAX || 4000)
const STOP_AFTER_EMPTY = 6
const CONCURRENCY = 16

const base = { Accept: 'application/json', t: '3', k: '3', token: session.token }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const byId = new Map()

function slim(v) {
  if (!v?.id) return null
  const name = v.name || v.title || ''
  if (!name || name.length < 4) return null
  return {
    id: String(v.id),
    name,
    coverURL: v.coverURL || v.verticalCoverURL || v.cover || '',
    time: Math.round(Number(v.time ?? v.duration ?? 0) || 0),
    playCnt: Number(v.playCnt ?? v.hot ?? 0) || 0,
  }
}

function absorb(v) {
  const s = slim(v)
  if (!s || !/^[a-f0-9]{24}$/i.test(s.id)) return false
  const prev = byId.get(s.id)
  if (!prev) {
    byId.set(s.id, s)
    return true
  }
  // Prefer richer metadata.
  if ((s.name?.length || 0) > (prev.name?.length || 0)) prev.name = s.name
  if (s.coverURL && !prev.coverURL) prev.coverURL = s.coverURL
  if (s.time > (prev.time || 0)) prev.time = s.time
  if (s.playCnt > (prev.playCnt || 0)) prev.playCnt = s.playCnt
  return false
}

function harvestDeep(obj, depth = 0) {
  if (!obj || depth > 14) return
  if (Array.isArray(obj)) {
    for (const x of obj) harvestDeep(x, depth + 1)
    return
  }
  if (typeof obj !== 'object') return
  if (obj.id || obj.name || obj.coverURL) absorb(obj)
  if (obj.video) harvestDeep(obj.video, depth + 1)
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v && typeof v === 'object') harvestDeep(v, depth + 1)
  }
}

function loadJson(rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

async function req(pathname, headers) {
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch(`${PROXY}${pathname}`, { headers })
    } catch {
      await sleep(500)
    }
  }
  return null
}

async function freshSid() {
  const r = await req('/speedtest?pid=FBI', base)
  return r ? (await r.json()).sid : null
}

async function call(pathname) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sid = await freshSid()
    const r = await req(`${pathname}${pathname.includes('?') ? '&' : '?'}pid=FBI`, { ...base, sid })
    if (!r) return null
    const j = await r.json()
    if (j.errorCode === 0) return unwrapApiPayload(j)
    if (!/^fail\/sid:/.test(j.message || '')) return null
  }
  return null
}

// --- 1) Local dumps ---
const localFiles = [
  'src/data/video-pool.json',
  'src/data/live-api.json',
  'src/data/feeds.json',
  'src/data/tabs.json',
  'crawled/_full-play-audit-2026-09-01.json',
  'crawled/_local-id-harvest.json',
  'crawled/audit-featured-api-bodies.json',
  'crawled/audit-featured-full-02.json',
  'crawled/p1-api-probe.json',
  'crawled/audit-master-2026-08-26.json',
]
for (const f of localFiles) {
  const j = loadJson(f)
  if (!j) continue
  const before = byId.size
  harvestDeep(j)
  console.log(`local ${f}: +${byId.size - before} (total ${byId.size})`)
}

// Regex-scan huge browser dump for 24-hex ids (metadata may be missing).
const big = path.join(ROOT, 'crawled/api/in-page/browser-api.json')
if (fs.existsSync(big)) {
  const text = fs.readFileSync(big, 'utf8')
  const re = /"id"\s*:\s*"([a-f0-9]{24})"/gi
  let m
  let added = 0
  while ((m = re.exec(text))) {
    if (!byId.has(m[1])) {
      byId.set(m[1], { id: m[1], name: m[1], coverURL: '', time: 0, playCnt: 0 })
      added++
    }
  }
  console.log(`local browser-api.json regex: +${added} (total ${byId.size})`)
}

// --- 2) Live recommend harvest (multiple sorts) ---
async function drainSort(sort) {
  let emptyStreak = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await call(`/videos/recommend?page=${page}&pageSize=20&sort=${sort}`)
    const list = data?.videos || []
    let added = 0
    for (const v of list) if (absorb(v)) added++
    process.stdout.write(`[${sort}] p${String(page).padStart(3)} got ${list.length} new ${added} pool ${byId.size}\n`)
    emptyStreak = added === 0 ? emptyStreak + 1 : 0
    if (emptyStreak >= STOP_AFTER_EMPTY) break
    await sleep(80)
  }
}

for (const sort of ['recommend', 'latest', 'hot']) {
  await drainSort(sort)
}

// --- 3) Enrich bare ids (name===id) via detail, drop dead ---
const bare = [...byId.values()].filter((v) => v.name === v.id || !v.coverURL)
console.log(`\nenrich/prune candidates: ${bare.length}`)
const dead = []
let i = 0
async function worker() {
  while (i < bare.length) {
    const idx = i++
    const row = bare[idx]
    try {
      const data = await call(`/videos/${row.id}`)
      if (!data?.video) {
        dead.push(row.id)
        byId.delete(row.id)
        continue
      }
      absorb({ ...data.video, playCnt: data.video.playCnt })
      // Keep only if stream exists (url or previewUrl or playURL)
      const hasStream = !!(data.url || data.previewUrl || data.video?.playURL || data.video?.mp4PlayURL)
      if (!hasStream && data.buyVideo) {
        // keep paywalled-with-preview-missing? drop if totally unplayable
        if (!data.previewUrl && !data.url) {
          // still keep titled card — PlayPage shows needBuy
        }
      }
    } catch {
      // network blip — keep
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

// Full liveness sweep on a denser sample if pool still huge: verify every id lacking cover
const all = [...byId.keys()]
console.log(`\nliveness sweep ${all.length} ids…`)
const gone = []
i = 0
async function liveWorker() {
  while (i < all.length) {
    const idx = i++
    const id = all[idx]
    const data = await call(`/videos/${id}`)
    if (!data) {
      // treat hard null / error payloads as gone when message known
      continue
    }
    // call() returns null on errorCode!=0 — need raw check
  }
}

// Dedicated dead check with raw API
async function checkDead(id) {
  const sid = await freshSid()
  const r = await req(`/videos/${id}?pid=FBI`, { ...base, sid })
  if (!r) return false
  const j = await r.json()
  if (j.errorCode && j.errorCode !== 0) {
    const msg = String(j.message || '')
    if (/不存在|已下架|下架/.test(msg)) return true
  }
  return false
}

i = 0
const ids = [...byId.keys()]
async function deadWorker() {
  while (i < ids.length) {
    const idx = i++
    const id = ids[idx]
    try {
      if (await checkDead(id)) {
        gone.push(id)
        byId.delete(id)
      }
    } catch {}
    if (idx % 100 === 0) process.stdout.write(`  checked ${idx}/${ids.length} gone ${gone.length}\n`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => deadWorker()))

// Drop placeholder names (id-as-name) that never got enriched
for (const [id, v] of [...byId.entries()]) {
  if (v.name === id && !v.coverURL) byId.delete(id)
}

let videos = [...byId.values()]
videos.sort((a, b) => (b.playCnt || 0) - (a.playCnt || 0))
if (videos.length > POOL_MAX) videos = videos.slice(0, POOL_MAX)

fs.writeFileSync(
  OUT,
  JSON.stringify({ at: new Date().toISOString(), videos, purged: gone.length }, null, 2) + '\n',
)
fs.writeFileSync(
  path.join(ROOT, 'crawled/_pool-expand-report.json'),
  JSON.stringify({ at: new Date().toISOString(), kept: videos.length, purged: gone, deadBare: dead }, null, 2),
)
console.log(`\nwrote ${videos.length} videos (purged ${gone.length} dead) → src/data/video-pool.json`)
