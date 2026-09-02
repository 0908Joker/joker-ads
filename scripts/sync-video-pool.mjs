#!/usr/bin/env node
/**
 * Harvest a video pool from the live API into src/data/video-pool.json.
 *
 * The origin's `categories/{id}` and `tag/videos/name` both answer 0 videos for
 * our token, so category tabs have no per-category source. `videos/recommend`
 * still paginates with distinct results, so we drain it and slice the pool per
 * tab instead of leaving tabs empty.
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
// Bigger pool → more distinct tab slices; publish still code-splits video-pool chunk.
const POOL_MAX = Number(process.env.POOL_MAX || 4000)
const STOP_AFTER_EMPTY = 6

const base = { Accept: 'application/json', t: '3', k: '3', token: session.token }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function req(pathname, headers) {
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch(`${PROXY}${pathname}`, { headers })
    } catch {
      await sleep(600)
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

/** Only the fields the feed card renders — keeps the baked file small. */
function slim(v) {
  if (!v?.id || !v?.name) return null
  return {
    id: v.id,
    name: v.name,
    coverURL: v.coverURL || v.verticalCoverURL || '',
    time: Math.round(v.time ?? 0),
    playCnt: v.playCnt ?? 0,
  }
}

const byId = new Map()
let emptyStreak = 0

for (let page = 1; page <= MAX_PAGES; page++) {
  const data = await call(`/videos/recommend?page=${page}&pageSize=20&sort=recommend`)
  const list = data?.videos || []
  let added = 0
  for (const v of list) {
    const s = slim(v)
    if (s && !byId.has(s.id)) {
      byId.set(s.id, s)
      added++
    }
  }
  process.stdout.write(`page ${String(page).padStart(3)}  got ${String(list.length).padStart(2)}  new ${String(added).padStart(2)}  pool ${byId.size}\n`)
  emptyStreak = added === 0 ? emptyStreak + 1 : 0
  if (emptyStreak >= STOP_AFTER_EMPTY) {
    console.log(`no new videos for ${STOP_AFTER_EMPTY} pages — stopping`)
    break
  }
  await sleep(150)
}

const videos = [...byId.values()].slice(0, POOL_MAX)
if (!videos.length) {
  console.error('harvested nothing — leaving existing pool untouched')
  process.exit(1)
}

let previous = 0
try {
  previous = JSON.parse(fs.readFileSync(OUT, 'utf8')).videos?.length || 0
} catch {}

fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), videos }, null, 2) + '\n')
console.log(`\nwrote ${videos.length} videos to src/data/video-pool.json (was ${previous})`)
