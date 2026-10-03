// Exercise the real admin API against disposable data, never production data.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const adminDir = process.env.AD_SYNC_ADMIN_DIR || path.join(root, 'admin')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-sync-test-'))
const dataDir = path.join(tmp, 'site-data')
let password = crypto.randomBytes(24).toString('hex')
const sample = {
  categories: ['官方推荐', '其他'],
  modes: [{ id: 'recommend', label: '站长推荐' }, { id: 'download', label: '热门下载' }],
  popups: [{ name: 'Legacy popup must not reappear', image: '/old.png' }],
  apps: [{ name: 'Existing', url: 'https://example.com/existing', icon: '' }],
  categoryApps: {
    byCategory: { '官方推荐': ['Existing'], '其他': [] },
    modes: { '站长推荐': ['Existing'], '热门下载': ['Existing'] },
    modesByCategory: { '官方推荐': { '站长推荐': ['Existing'] } },
  },
}
for (const stage of ['live', 'draft']) {
  fs.mkdirSync(path.join(dataDir, stage), { recursive: true })
  for (const [file, value] of Object.entries({ config: sample, popups: { afterEnterApp: [], gridPopAds: [] }, tabs: {}, meta: { version: 1 } })) {
    fs.writeFileSync(path.join(dataDir, stage, `${file}.json`), JSON.stringify(value), { mode: 0o600 })
  }
}
const port = await new Promise((resolve, reject) => {
  const server = net.createServer()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)) })
})
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: adminDir, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ADMIN_HOST: '127.0.0.1', ADMIN_PORT: String(port), SITE_DATA_DIR: dataDir,
    UPLOAD_DIR: path.join(tmp, 'uploads'), ADMIN_DB_PATH: path.join(tmp, 'test.sqlite'),
    ADMIN_BOOTSTRAP_USER: 'ad-sync-test', ADMIN_BOOTSTRAP_PASS: password },
})
let output = ''
child.stdout.on('data', x => { output += x })
child.stderr.on('data', x => { output += x })
const origin = `http://127.0.0.1:${port}`
let cookie = ''
async function request(url, method = 'GET', body) {
  const r = await fetch(origin + url, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body) })
  const value = await r.json()
  assert.equal(r.ok, true, `${method} ${url}: ${r.status}`)
  return { r, value }
}
const publish = () => request('/api/admin/publish', 'POST', {})
const live = async () => (await request('/data/config.json')).value
const snapshots = {}
async function snapshot(name) {
  snapshots[name] = { config: await live(), popups: (await request('/data/popups.json')).value, tabs: {}, meta: { version: 1 }, 'api-session': {} }
}
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Isolated admin exited: ${output}`)
    try { ready = (await fetch(origin + '/health')).ok } catch {}
    if (ready) break
    await new Promise(r => setTimeout(r, 100))
  }
  assert.ok(ready, 'isolated admin started')
  const login = await request('/api/admin/login', 'POST', { username: 'ad-sync-test', password })
  cookie = login.r.headers.get('set-cookie').split(';')[0]
  const nextPassword = crypto.randomBytes(24).toString('hex')
  await request('/api/admin/change-password', 'POST', { oldPassword: password, newPassword: nextPassword })
  password = nextPassword
  const relogin = await request('/api/admin/login', 'POST', { username: 'ad-sync-test', password })
  cookie = relogin.r.headers.get('set-cookie').split(';')[0]
  const beforeInvalid = fs.readFileSync(path.join(dataDir, 'draft/config.json'), 'utf8')
  const invalid = await fetch(origin + '/api/admin/site-config/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ apps: {} }) })
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).field, 'config.apps')
  assert.equal(fs.readFileSync(path.join(dataDir, 'draft/config.json'), 'utf8'), beforeInvalid)
  const duplicateFixture = structuredClone(sample)
  duplicateFixture.apps.push({ name: 'Existing', url: 'https://example.com/last', icon: '/last.png', preserved: 1 })
  await request('/api/admin/site-config/config', 'PUT', duplicateFixture)
  const canonicalList = (await request('/api/admin/apps')).value.apps
  assert.equal(canonicalList.length, 1)
  assert.equal(canonicalList[0].url, 'https://example.com/last')
  assert.equal(canonicalList[0].duplicateCount, 2)
  await request('/api/admin/apps/Existing', 'PUT', { url: 'https://example.com/synced' })
  let duplicates = (await request('/api/admin/site-config')).value.config.apps
  assert.equal(duplicates.length, 2)
  assert.ok(duplicates.every(app => app.url === 'https://example.com/synced' && app.icon === '/last.png'))
  assert.equal(duplicates[1].preserved, 1)
  await request('/api/admin/site-config/config', 'PUT', sample)
  for (const name of ['100% QA', '中文应用', '目录/应用']) {
    await request('/api/admin/apps', 'POST', { name, url: 'https://example.com/name' })
    await request('/api/admin/apps/' + encodeURIComponent(name), 'PUT', { name: name + '改', url: 'https://example.com/edited' })
    await request('/api/admin/apps/' + encodeURIComponent(name + '改'), 'DELETE')
  }
  for (const slot of ['mineQuickApps', 'featuredAd']) {
    const value = slot === 'mineQuickApps' ? { items: [{ name: 'Quick', url: 'https://example.com/quick' }] } : { name: 'Featured', url: 'https://example.com/featured' }
    await request('/api/admin/slots/' + slot, 'PUT', value)
  }
  await publish()
  let atomicBundle = (await request('/data/site-bundle.json')).value
  assert.equal(atomicBundle.tabs.mine.quickApps[0].name, 'Quick')
  assert.equal(atomicBundle.tabs.featured.ad.name, 'Featured')
  for (const [file, key] of [['config', 'config'], ['popups', 'popups'], ['tabs', 'tabs'], ['api-session', 'apiSession'], ['meta', 'meta']]) {
    assert.deepEqual((await request('/data/' + file + '.json')).value, atomicBundle[key])
  }
  await request('/api/admin/slots/mineQuickApps', 'PUT', { items: [] })
  await request('/api/admin/slots/featuredAd', 'PUT', { name: '', url: '', viewers: '' })
  await publish()
  atomicBundle = (await request('/data/site-bundle.json')).value
  assert.deepEqual(atomicBundle.tabs.mine.quickApps, [])
  assert.equal(atomicBundle.tabs.featured.ad.name, '')
  console.log('PASS invalid save unchanged; canonical duplicate edit; percent/Chinese/slash CRUD; slots clear; snapshot compatibility')
  const uploadForm = new FormData()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64')
  uploadForm.append('file', new Blob([png], { type: 'image/png' }), 'sync-test.png')
  const uploadResponse = await fetch(origin + '/api/admin/upload?kind=popup', { method: 'POST', headers: { Cookie: cookie }, body: uploadForm })
  assert.ok(uploadResponse.ok, 'upload accepted')
  const uploaded = await uploadResponse.json()
  const uploadedImage = await fetch(origin + uploaded.url)
  assert.ok(uploadedImage.ok, 'uploaded image publicly readable')
  assert.deepEqual(Buffer.from(await uploadedImage.arrayBuffer()), png)
  console.log('PASS material upload -> public image bytes')
  await request('/api/admin/apps', 'POST', { name: 'Sync QA', url: 'https://example.com/new', icon: '' })
  assert.equal((await live()).apps.some(x => x.name === 'Sync QA'), false, 'draft remains unpublished')
  await publish()
  let c = await live()
  assert.ok(c.apps.some(x => x.name === 'Sync QA'), 'added app is published')
  assert.ok(c.categoryApps.byCategory['官方推荐'].includes('Sync QA'), 'new app must appear in the frontend category')
  assert.ok(c.categoryApps.modes['站长推荐'].includes('Sync QA'), 'new app must survive the recommendation filter')
  assert.ok(c.categoryApps.modesByCategory['官方推荐']['站长推荐'].includes('Sync QA'), 'new app must survive category recommendations')
  console.log('PASS add -> publish -> visible category')
  await snapshot('added')
  const duplicate = await fetch(origin + '/api/admin/apps/Sync%20QA', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ name: 'Existing' }) })
  assert.equal(duplicate.status, 409, 'rename cannot collide with another app')
  await request('/api/admin/apps/Sync%20QA', 'PUT', { name: 'Renamed QA', url: 'https://example.com/changed' })
  await publish()
  c = await live()
  assert.ok(c.categoryApps.byCategory['官方推荐'].includes('Renamed QA'), 'rename retains placement')
  assert.ok(!JSON.stringify(c.categoryApps).includes('Sync QA'), 'rename removes old placement references')
  assert.equal(c.apps.find(x => x.name === 'Renamed QA').url, 'https://example.com/changed')
  console.log('PASS rename and link update -> publish')
  await snapshot('renamed')
  await request('/api/admin/apps/Renamed%20QA', 'DELETE')
  await publish()
  c = await live()
  assert.ok(!c.apps.some(x => x.name === 'Renamed QA'), 'deleted app absent')
  assert.ok(!JSON.stringify(c.categoryApps).includes('Renamed QA'), 'deleted placements absent')
  console.log('PASS delete -> publish -> absent from every placement')
  await snapshot('deleted')
  for (const items of [[{ name: 'Test popup', image: '/uploads/popups/test.png', url: 'https://example.com/popup' }], []]) {
    await request('/api/admin/slots/afterEnterApp', 'PUT', { items })
    await publish()
    assert.deepEqual((await request('/data/popups.json')).value.afterEnterApp, items)
  }
  console.log('PASS popup add and clear -> publish -> runtime JSON')
  await snapshot('empty')
  await request('/api/admin/slots/afterEnterApp', 'PUT', { items: [{ name: 'Changed image', coverUrl: '/old.png', image: '/new.png', url: 'https://example.com/new-popup' }] })
  await publish()
  await snapshot('popup')
  await request('/api/admin/slots/afterEnterApp', 'PUT', { items: [] })
  await request('/api/admin/slots/gridPopAds', 'PUT', { items: [{ name: 'Changed grid image', coverUrl: '/old.png', image: '/new.png', url: 'https://example.com/new-grid' }] })
  await publish()
  await snapshot('grid')
  const result = await request('/data/config.json')
  assert.match(result.r.headers.get('cache-control'), /no-store/)
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dataDir, 'live/config.json')).mode & 0o777, 0o600)
  console.log('PASS repeated atomic publications remain readable with no-store')
  if (process.env.AD_SYNC_BROWSER_BUNDLE) {
    const fixture = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const selected = /qaFixture=(\w+)/.exec(req.headers.cookie || '')?.[1] || 'empty'
      const data = /^\/data\/([\w-]+)\.json$/.exec(url.pathname)
      res.setHeader('Cache-Control', 'no-store')
      if (data) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(snapshots[selected]?.[data[1]] || {})) }
      if (url.pathname.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); return res.end('{"isNew":false}') }
      if (url.pathname === '/bundle.js' || url.pathname === '/before.js') {
        res.setHeader('Content-Type', 'text/javascript')
        return fs.createReadStream(url.pathname === '/before.js' ? path.join(path.dirname(process.env.AD_SYNC_BROWSER_BUNDLE), 'production.js') : process.env.AD_SYNC_BROWSER_BUNDLE).pipe(res)
      }
      if (url.pathname === '/style.css' && process.env.AD_SYNC_BROWSER_CSS) {
        res.setHeader('Content-Type', 'text/css')
        return fs.createReadStream(process.env.AD_SYNC_BROWSER_CSS).pipe(res)
      }
      if (url.pathname.endsWith('.png') || url.pathname.endsWith('.webp') || url.pathname.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/svg+xml')
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="teal"/><text x="10" y="50" fill="white">SYNC TEST</text></svg>')
      }
      const phase = url.pathname.split('/')[1]
      if (!snapshots[phase]) { res.statusCode = 404; return res.end() }
      res.setHeader('Set-Cookie', `qaFixture=${phase}; Path=/; SameSite=Lax`)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:")
      res.end(`<!doctype html><html><head><title>广告同步隔离验收</title>${process.env.AD_SYNC_BROWSER_CSS ? '<link rel="stylesheet" href="/style.css">' : ''}<style>html{font-size:48px}body{font-size:16px}.popup-img{width:200px}</style></head><body><div id="app"></div><script type="module" src="/${url.searchParams.has('before') ? 'before' : 'bundle'}.js"></script></body></html>`)
    })
    await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve))
    console.log(`BROWSER_FIXTURE http://127.0.0.1:${fixture.address().port}/empty/#/appcenter (added, renamed, deleted, empty, popup, grid; ?before for old bundle)`)
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve) })
    fixture.close()
  }
} finally {
  child.kill()
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve) })
  fs.rmSync(tmp, { recursive: true, force: true })
}
