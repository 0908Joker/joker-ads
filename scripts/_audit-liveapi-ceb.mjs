#!/usr/bin/env node
import fs from 'fs'
import CryptoJS from 'crypto-js'

const RES = 'https://d17e80montytxe.cloudfront.net'
const KEY = '82758dd12749c777ef579f1839ceea6a'
const live = JSON.parse(fs.readFileSync('src/data/live-api.json', 'utf8'))

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

const covers = new Set()
function walk(o) {
  if (!o || typeof o !== 'object') return
  if (Array.isArray(o)) return o.forEach(walk)
  for (const [k, v] of Object.entries(o)) {
    if (
      typeof v === 'string' &&
      /cover|avatar|imgUrl|icon/i.test(k) &&
      /\.(ceb|geb)(\?|$)/i.test(v.split('@')[0])
    ) {
      covers.add(v.split('@')[0])
    } else if (v && typeof v === 'object') walk(v)
  }
}
walk(live)
const list = [...covers]
console.log('unique encrypted in live-api:', list.length)

const sample = list.slice(0, 50)
let ok = 0
let fail = 0
const fails = []
for (const p of sample) {
  const url = /^https?:/i.test(p) ? p : `${RES}/${p.replace(/^\/+/, '')}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      fail++
      fails.push({ p, err: `http ${res.status}` })
      continue
    }
    const u8 = new Uint8Array(await res.arrayBuffer())
    if (decrypt(u8)) ok++
    else {
      fail++
      fails.push({ p, err: 'decrypt fail', bytes: u8.length })
    }
  } catch (e) {
    fail++
    fails.push({ p, err: String(e.message || e) })
  }
}

const out = {
  uniqueEncrypted: list.length,
  sampled: sample.length,
  ok,
  fail,
  failRate: sample.length ? +(fail / sample.length).toFixed(4) : null,
  fails,
  extCounts: {
    ceb: list.filter((p) => /\.ceb$/i.test(p)).length,
    geb: list.filter((p) => /\.geb$/i.test(p)).length,
  },
}
fs.writeFileSync('crawled/audit-16-liveapi-ceb-sample.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
