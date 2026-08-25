#!/usr/bin/env node
/** Fetch per-tab short feeds via direct API → merge into live-api.json shortByTab */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { unwrapApiPayload } from '../src/api/decrypt.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = path.join(ROOT, 'src/data/live-api.json')
const SHORT_CAT = path.join(ROOT, 'src/data/short-categories.json')
const SESSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/api-session.json'), 'utf8'))
const BASE = 'https://deuwy.jcd9nw.com/api/v1'

async function apiGet(path, params = {}) {
  const q = new URLSearchParams({ ...params, pid: 'FBI' })
  const res = await fetch(`${BASE}${path}?${q}`, {
    headers: { Accept: 'application/json', t: '3', k: '3', token: SESSION.token },
  })
  const j = await res.json()
  if (j.errorCode && j.errorCode !== 0) {
    return { errorCode: j.errorCode, message: j.message, data: null }
  }
  return { errorCode: 0, data: unwrapApiPayload(j) ?? j.data }
}

const live = JSON.parse(fs.readFileSync(LIVE, 'utf8'))
const cats = JSON.parse(fs.readFileSync(SHORT_CAT, 'utf8')).categories || []
live.shortByTab = live.shortByTab || {}

for (const c of cats) {
  const r = await apiGet('/videos/short', { page: 1, pageSize: 10, categorieId: c.categorieId })
  if (r.data) live.shortByTab[c.name] = r.data
  const n = (r.data?.videoInfo || r.data?.videos || []).length
  console.log(c.name, r.errorCode || 0, n, (r.data?.videoInfo?.[0]?.video?.name || '').slice(0, 40))
}

const drama = await apiGet('/videos/shortAndImg', { page: 1, pageSize: 10, tab: '短剧' })
if (drama.data) live.shortByTab['短剧'] = drama.data
console.log('短剧', drama.errorCode || 0, (drama.data?.videoInfo || []).length)

live.short = live.shortByTab['抖阴'] || live.short
live.at = new Date().toISOString()
fs.writeFileSync(LIVE, JSON.stringify(live, null, 2))
console.log('✅ updated', LIVE)
