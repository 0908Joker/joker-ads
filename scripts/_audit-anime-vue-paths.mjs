#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import CryptoJS from 'crypto-js'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RES = 'https://d17e80montytxe.cloudfront.net'
const KEY = '82758dd12749c777ef579f1839ceea6a'

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

const browser = await chromium.launch({ headless: true })
const page = await (
  await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    viewport: { width: 390, height: 844 },
  })
).newPage()

const net = []
page.on('request', (req) => {
  const u = req.url()
  if (/\.(ceb|geb)(\?|$)/i.test(u) || /comics\/oldDriver|media\/albums/i.test(u)) {
    net.push({ type: 'req', u: u.slice(0, 180) })
  }
})
page.on('response', (res) => {
  const u = res.url()
  if (/\.(ceb|geb)(\?|$)/i.test(u) || /comics\/oldDriver|media\/albums/i.test(u)) {
    net.push({ type: 'res', status: res.status(), u: u.slice(0, 180) })
  }
})

await page.goto('https://b12sl5x.cn/#/vipPage', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
await page.waitForTimeout(10000)

const cards = await page.evaluate(() => {
  return [...document.querySelectorAll('.comic-card')].map((card) => {
    const title = (card.querySelector('h4')?.textContent || '').trim()
    const el = card.querySelector('.ceb-wrap')
    const vc = el?.__vueParentComponent
    let p = ''
    if (vc?.props?.path) p = vc.props.path
    else if (vc?.vnode?.props?.path) p = vc.vnode.props.path
    else if (vc?.subTree?.props?.path) p = vc.subTree.props.path
    // CebImg is child of wrap's parent component
    const childInst = el && Object.keys(el).find((k) => k.startsWith('__vue'))
    return {
      title: title.slice(0, 60),
      path: p,
      blank: !card.querySelector('img.ceb-img'),
      vueKeys: el ? Object.keys(el).filter((k) => k.includes('vue')).slice(0, 5) : [],
      propKeys: vc ? Object.keys(vc.props || {}) : [],
    }
  })
})

// Also try getting path from Vue app via internal instance scan
const scanned = await page.evaluate(() => {
  const found = []
  const root = document.querySelector('#app')?.__vue_app__?._instance
  const visit = (comp, depth = 0) => {
    if (!comp || depth > 40) return
    const setup = comp.setupState
    if (setup && typeof setup === 'object') {
      const secs = setup.filteredSections || setup.liveSections || setup.preview
      const list = []
      if (Array.isArray(setup.preview)) list.push(...setup.preview)
      if (Array.isArray(setup.previewItems)) list.push(...setup.previewItems)
      if (secs?.value && Array.isArray(secs.value)) {
        for (const s of secs.value) if (Array.isArray(s.items)) list.push(...s.items)
      }
      if (Array.isArray(secs)) {
        for (const s of secs) if (Array.isArray(s.items)) list.push(...s.items)
      }
      // ref unwrapping
      const maybe = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x)
      for (const key of ['preview', 'previewItems', 'filteredSections', 'liveSections', 'comics']) {
        let v = maybe(setup[key])
        if (!v) continue
        if (Array.isArray(v) && v[0]?.cover !== undefined) {
          for (const it of v) found.push({ title: it.title, cover: it.cover, coverLocal: it.coverLocal, from: key })
        }
        if (Array.isArray(v) && v[0]?.items) {
          for (const s of v) {
            for (const it of s.items || []) {
              found.push({
                title: it.title,
                cover: it.cover,
                coverLocal: it.coverLocal,
                from: key + ':' + s.title,
              })
            }
          }
        }
      }
    }
    const sub = comp.subTree
    const stack = [sub]
    while (stack.length) {
      const n = stack.pop()
      if (!n) continue
      if (n.component) visit(n.component, depth + 1)
      const ch = n.children
      if (Array.isArray(ch)) for (const c of ch) stack.push(c)
      if (n.suspense) stack.push(n.suspense)
    }
  }
  if (root) visit(root)
  return found
})

const probes = []
const targets = scanned.length
  ? scanned
  : cards.map((c) => ({ title: c.title, cover: c.path, coverLocal: '', from: 'dom' }))

const seen = new Set()
for (const t of targets) {
  const raw = t.coverLocal || t.cover || ''
  const key = `${t.title}|${raw}`
  if (seen.has(key)) continue
  seen.add(key)
  if (!raw) {
    probes.push({ title: t.title, from: t.from, ok: false, err: 'empty cover' })
    continue
  }
  const rel = String(raw)
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^\/+/, '')
    .split('@')[0]
  if (/\.(ceb|geb)(\?|$)/i.test(rel)) {
    const url = /^https?:/i.test(raw) ? String(raw).split('@')[0] : `${RES}/${rel}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) {
        probes.push({ title: t.title, from: t.from, kind: 'ceb', ok: false, err: `http ${res.status}`, path: rel })
        continue
      }
      const u8 = new Uint8Array(await res.arrayBuffer())
      const d = decrypt(u8)
      probes.push({
        title: t.title,
        from: t.from,
        kind: 'ceb',
        ok: !!d,
        err: d ? '' : 'decrypt fail',
        path: rel,
        bytes: u8.length,
      })
    } catch (e) {
      probes.push({ title: t.title, from: t.from, kind: 'ceb', ok: false, err: String(e.message || e), path: rel })
    }
  } else {
    // plain / local
    const local = rel.match(/^comics\/oldDriver\/([^/]+)\/(cover_[^/?#]+)$/i)
    if (local) {
      const fp = path.join(ROOT, 'public/comics', `comics_oldDriver_${local[1]}_${local[2]}`)
      // also check CDN reachability
      let cdnOk = false
      try {
        const r = await fetch(`${RES}/${rel}`, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
        cdnOk = r.ok
      } catch {}
      probes.push({
        title: t.title,
        from: t.from,
        kind: 'comic-plain',
        ok: fs.existsSync(fp) || cdnOk,
        localExists: fs.existsSync(fp),
        cdnOk,
        path: rel,
      })
    } else {
      probes.push({ title: t.title, from: t.from, kind: 'other', ok: true, path: rel })
    }
  }
}

const out = {
  at: new Date().toISOString(),
  uiCards: cards,
  scannedCount: scanned.length,
  scannedSample: scanned.slice(0, 15),
  net,
  probe: {
    total: probes.length,
    ok: probes.filter((p) => p.ok).length,
    fail: probes.filter((p) => !p.ok).length,
    failRate: probes.length ? +(probes.filter((p) => !p.ok).length / probes.length).toFixed(4) : null,
    fails: probes.filter((p) => !p.ok),
    oks: probes.filter((p) => p.ok).slice(0, 10),
  },
}
fs.writeFileSync(path.join(ROOT, 'crawled/audit-16-anime-vue-paths.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out.probe, null, 2))
console.log('ui blanks', cards.filter((c) => c.blank).length, '/', cards.length)
console.log('net', net.length, net.slice(0, 10))
await browser.close()
