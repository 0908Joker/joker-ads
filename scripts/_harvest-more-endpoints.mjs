#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { unwrapApiPayload } from '../src/api/decrypt.js'
import session from '../src/data/api-session.json' with { type: 'json' }
import cats from '../src/data/short-categories.json' with { type: 'json' }
import videoCats from '../src/data/video-categories.json' with { type: 'json' }

const PROXY = 'https://al-ads.com/api-proxy'
const base = { Accept: 'application/json', t: '3', k: '3', token: session.token }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pool = JSON.parse(readFileSync(new URL('../src/data/video-pool.json', import.meta.url), 'utf8'))
const byId = new Map(pool.videos.map((v) => [v.id, v]))

function absorb(v) {
  if (!v?.id || !/^[a-f0-9]{24}$/i.test(v.id)) return false
  const name = v.name || v.title || ''
  if (!name || name.length < 4) return false
  if (byId.has(v.id)) return false
  byId.set(v.id, {
    id: v.id,
    name,
    coverURL: v.coverURL || v.verticalCoverURL || v.cover || '',
    time: Math.round(Number(v.time ?? 0) || 0),
    playCnt: Number(v.playCnt ?? v.hot ?? 0) || 0,
  })
  return true
}

async function freshSid() {
  const r = await fetch(`${PROXY}/speedtest?pid=FBI`, { headers: base })
  return (await r.json()).sid
}

async function call(path) {
  for (let a = 0; a < 2; a++) {
    const sid = await freshSid()
    const r = await fetch(`${PROXY}${path}${path.includes('?') ? '&' : '?'}pid=FBI`, {
      headers: { ...base, sid },
    })
    const j = await r.json()
    if (j.errorCode === 0) return unwrapApiPayload(j)
    if (!/^fail\/sid:/.test(j.message || '')) return { __err: j.message, __code: j.errorCode }
  }
  return null
}

function takeVideos(data) {
  if (!data || data.__err) return []
  if (Array.isArray(data.videos)) return data.videos
  if (Array.isArray(data.list)) return data.list
  if (Array.isArray(data.videoInfo)) return data.videoInfo.map((r) => r.video || r)
  if (Array.isArray(data.records)) return data.records
  const out = []
  for (const c of data.childCategories || []) if (Array.isArray(c.videos)) out.push(...c.videos)
  return out
}

let added = 0

for (const c of cats.categories || []) {
  for (let page = 1; page <= 20; page++) {
    const data = await call(`/videos/short?page=${page}&pageSize=20&categorieId=${c.categorieId}`)
    const list = takeVideos(data)
    let n = 0
    for (const v of list) if (absorb(v)) { n++; added++ }
    console.log(`short ${c.name} p${page} got ${list.length} new ${n} pool ${byId.size}`)
    if (!list.length) break
    await sleep(50)
  }
}

for (let page = 1; page <= 20; page++) {
  const data = await call(`/videos/shortAndImg?page=${page}&pageSize=20`)
  const list = takeVideos(data)
  let n = 0
  for (const v of list) if (absorb(v)) { n++; added++ }
  console.log(`shortAndImg p${page} got ${list.length} new ${n} pool ${byId.size}`)
  if (!list.length) break
  await sleep(50)
}

for (let page = 1; page <= 50; page++) {
  const data = await call(`/algoRecommend/getList?page=${page}&pageSize=20`)
  const list = takeVideos(data)
  let n = 0
  for (const v of list) if (absorb(v)) { n++; added++ }
  console.log(`algo p${page} got ${list.length} new ${n} pool ${byId.size}`)
  if (!list.length && page > 2) break
  await sleep(50)
}

for (const c of videoCats.categories || []) {
  const id = c.id || c.categoryId || c.categorieId
  if (!id) continue
  for (let page = 1; page <= 5; page++) {
    const data = await call(
      `/categories/${id}?page=${page}&pageSize=40&timeType=1&compositeSort=1&inPool=true`,
    )
    const list = takeVideos(data)
    let n = 0
    for (const v of list) if (absorb(v)) { n++; added++ }
    console.log(`cat ${c.name} p${page} got ${list.length} new ${n} err=${data?.__err || ''}`)
    if (!list.length) break
    await sleep(50)
  }
}

// Try filter endpoint with broad params
for (const sort of ['1', '2', '3']) {
  for (let page = 1; page <= 30; page++) {
    const data = await call(`/videos/filter?page=${page}&pageSize=20&compositeSort=${sort}&timeType=1`)
    const list = takeVideos(data)
    let n = 0
    for (const v of list) if (absorb(v)) { n++; added++ }
    console.log(`filter sort${sort} p${page} got ${list.length} new ${n} pool ${byId.size} err=${data?.__err || ''}`)
    if (!list.length) break
    await sleep(50)
  }
}

try {
  const big = JSON.parse(readFileSync(new URL('../crawled/api/in-page/browser-api.json', import.meta.url), 'utf8'))
  const before = byId.size
  const walk = (o, d = 0) => {
    if (!o || d > 12) return
    if (Array.isArray(o)) return o.forEach((x) => walk(x, d + 1))
    if (typeof o !== 'object') return
    if (o.id && (o.name || o.title) && (o.coverURL || o.playCnt != null || o.time != null)) absorb(o)
    if (o.video) walk(o.video, d + 1)
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1)
  }
  walk(big)
  console.log(`browser-api deep +${byId.size - before}`)
} catch (e) {
  console.log('browser-api skip', e.message)
}

const videos = [...byId.values()].sort((a, b) => (b.playCnt || 0) - (a.playCnt || 0))
writeFileSync(
  new URL('../src/data/video-pool.json', import.meta.url),
  JSON.stringify({ at: new Date().toISOString(), videos }, null, 2) + '\n',
)
console.log(`DONE pool=${videos.length} addedThisRun=${added}`)
