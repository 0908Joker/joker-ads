#!/usr/bin/env node
/** Probe P1 APIs: circle moduleCHJ, voting, comic list/preview, short tabs */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { unwrapApiPayload } from '../src/api/decrypt.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SESSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/api-session.json'), 'utf8'))
const BASES = ['https://deuwy.jcd9nw.com', 'https://4p3kb.et8h6.cc']
const OUT = path.join(ROOT, 'crawled/p1-api-probe.json')

async function call(base, apiPath, params = {}) {
  const q = new URLSearchParams({ ...params, pid: 'FBI' })
  const url = `${base}/api/v1${apiPath}?${q}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', t: '3', k: '3', token: SESSION.token },
    })
    const j = await res.json()
    const data = unwrapApiPayload(j) ?? j.data
    return { ok: !j.errorCode, errorCode: j.errorCode, message: j.message, data, base }
  } catch (e) {
    return { ok: false, error: String(e), base }
  }
}

async function withBases(apiPath, params) {
  for (const base of BASES) {
    const r = await call(base, apiPath, params)
    if (r.ok || r.errorCode !== 1067) return r
  }
  return call(BASES[0], apiPath, params)
}

const report = { at: new Date().toISOString(), results: {} }

report.results.voting = await withBases('/circle/getAllCircleVoting', { page: 1, pageSize: 10 })
report.results.moduleCHJ = await withBases('/circle/moduleCHJ', {
  page: 1,
  pageSize: 10,
  type: 'basic',
  index: 0,
  compositeSort: 4,
})
report.results.homeComicSuper = await withBases('/comics/getHomeComic_super', {})

const superData = report.results.homeComicSuper.data
const sections = Array.isArray(superData) ? superData : []
report.results.homeComicSuperSummary = sections.map((s) => ({
  id: s.id,
  flagName: s.flagName,
  name: s.name,
  listLen: (s.comicList || s.list || []).length,
  keys: Object.keys(s).slice(0, 12),
}))

if (sections[0]?.id) {
  report.results.comicList0 = await withBases(`/comics/getComicList/${sections[0].id}`, {
    page: 1,
    pageSize: 10,
    isMore: false,
  })
}
const previewSec = sections.find((s) => /更新|预告|最近/.test(s.flagName || s.name || '')) || sections[0]
if (previewSec?.id) {
  const d = new Date()
  const searchDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  report.results.previewComics = await withBases(`/comics/getPreviewComics/${previewSec.id}`, {
    page: 1,
    searchDate,
  })
}

const shorts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/short-categories.json'), 'utf8')).categories || []
report.results.shortByTab = {}
for (const c of shorts) {
  const r = await withBases('/videos/short', { page: 1, pageSize: 10, categorieId: c.categorieId })
  const list = r.data?.videoInfo || r.data?.videos || []
  report.results.shortByTab[c.name] = {
    errorCode: r.errorCode,
    count: list.length,
    first: list[0]?.video?.name || list[0]?.name,
  }
}

const cats = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/video-categories.json'), 'utf8')).categories || []
report.results.featuredByCat = {}
for (const c of cats.slice(0, 5)) {
  const r = await withBases(`/categories/${c.id}`, {
    page: 1,
    pageSize: 20,
    timeType: 1,
    compositeSort: 1,
    inPool: true,
  })
  const videos = r.data?.videos || []
  report.results.featuredByCat[c.name] = {
    errorCode: r.errorCode,
    count: videos.length,
    first: videos[0]?.name?.slice(0, 40),
  }
}

function summarize(node, depth = 0) {
  if (node == null || depth > 2) return node
  if (Array.isArray(node)) {
    return { length: node.length, sample: summarize(node[0], depth + 1) }
  }
  if (typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      if (Array.isArray(v)) out[k] = { length: v.length, sampleKeys: v[0] ? Object.keys(v[0]).slice(0, 10) : [] }
      else if (v && typeof v === 'object') out[k] = Object.keys(v).slice(0, 12)
      else out[k] = v
    }
    return out
  }
  return node
}

report.shapes = {
  voting: summarize(report.results.voting.data),
  moduleCHJ: summarize(report.results.moduleCHJ.data),
  comicList0: summarize(report.results.comicList0?.data),
  previewComics: summarize(report.results.previewComics?.data),
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  voting: report.results.voting.errorCode ?? report.results.voting.error,
  moduleCHJ: report.results.moduleCHJ.errorCode ?? report.results.moduleCHJ.error,
  homeComic: report.results.homeComicSuper.errorCode,
  sections: report.results.homeComicSuperSummary,
  comicList: report.results.comicList0?.errorCode,
  preview: report.results.previewComics?.errorCode,
  shorts: report.results.shortByTab,
  featured: report.results.featuredByCat,
  shapes: report.shapes,
}, null, 2))
