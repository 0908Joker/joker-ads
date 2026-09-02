#!/usr/bin/env node
import fs from 'fs'
import CryptoJS from 'crypto-js'

const RES = 'https://d17e80montytxe.cloudfront.net'
const KEY = '82758dd12749c777ef579f1839ceea6a'
const paths = [
  'media/albums/465514.ceb',
  'media/albums/520592.ceb',
  'media/albums/454154.ceb',
  'media/albums/505085.ceb',
  'media/albums/1224243.ceb',
  'web/static/f8e5286fe9802fbe6efb53a59b61b403.geb',
  'comics/oldDriver/d52e0da3ba565788/cover_6cd3db3629b0d21ec9ed1e8b115a4b6ae945c8ab.png',
  'comics/oldDriver/3b495974ab7eaeeb/cover_7b0e28c1d86deeffd02627980144d08c6babed1c.png',
]

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

const rows = []
for (const p of paths) {
  const url = `${RES}/${p}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      rows.push({ path: p, ok: false, err: `http ${res.status}` })
      continue
    }
    const u8 = new Uint8Array(await res.arrayBuffer())
    if (/\.(ceb|geb)$/i.test(p)) {
      const d = decrypt(u8)
      rows.push({
        path: p,
        ok: !!d,
        err: d ? '' : 'decrypt fail',
        bytes: u8.length,
        mime: d ? d.slice(0, 30) : '',
      })
    } else {
      rows.push({ path: p, ok: true, kind: 'plain', bytes: u8.length })
    }
  } catch (e) {
    rows.push({ path: p, ok: false, err: String(e.message || e) })
  }
}

const out = {
  at: new Date().toISOString(),
  rows,
  fail: rows.filter((r) => !r.ok),
  ok: rows.filter((r) => r.ok),
}
fs.writeFileSync('crawled/audit-16-broken-samples.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
