import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import net from 'node:net'
import vm from 'node:vm'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = process.env.AUDIT_ADMIN_DIR || path.join(root, 'admin')
const requireAdmin = createRequire(path.join(dir, 'package.json'))
const Database = requireAdmin('better-sqlite3')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'joker-security-'))
const dbPath = path.join(tmp, 'db.sqlite')
const dataDir = path.join(tmp, 'data')
const password = crypto.randomBytes(24).toString('hex')
// Exercise the real initializer, including a pre-existing database without env credentials.
for (const [label, secret, succeeds] of [['missing', '', false], ['short', 'short', false], ['public-default', 'ChangeMeNow1!', false], ['explicit', password, true]]) {
  const fixtureDb = path.join(tmp, 'bootstrap-' + label + '.sqlite')
  const env = { ...process.env, ADMIN_DB_PATH: fixtureDb, SITE_DATA_DIR: dataDir, ADMIN_BOOTSTRAP_PASS: secret, ADMIN_BOOTSTRAP_USER: 'fixture' }
  const command = `import {getDb} from ${JSON.stringify(pathToFileURL(path.join(dir, 'lib/db.mjs')).href)};getDb().close()`
  const created = spawnSync(process.execPath, ['--input-type=module', '-e', command], { env, encoding: 'utf8' })
  assert.equal(created.status === 0, succeeds, 'bootstrap ' + label)
  if (!succeeds) assert.match(created.stderr, /explicit non-default/)
  else {
    const existing = spawnSync(process.execPath, ['--input-type=module', '-e', command], { env: { ...env, ADMIN_BOOTSTRAP_PASS: '' }, encoding: 'utf8' })
    assert.equal(existing.status, 0, 'existing database needs no bootstrap credential')
  }
}
console.log('PASS real bootstrap rejects missing/short/public-default passwords; existing database remains compatible')
for (const stage of ['live', 'draft']) {
  fs.mkdirSync(path.join(dataDir, stage), { recursive: true })
  for (const [name, value] of Object.entries({ config: { apps: [], categories: [] }, popups: {}, tabs: {}, meta: { version: 1 }, 'api-session': {} })) {
    fs.writeFileSync(path.join(dataDir, stage, name + '.json'), JSON.stringify(value))
  }
  fs.writeFileSync(path.join(dataDir, stage, 'config.json.bak'), '{"privateFixture":true}')
}
const port = await new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)) }) })
const child = spawn(process.execPath, ['server.mjs'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: {
  ...process.env, ADMIN_PORT: String(port), ADMIN_HOST: '127.0.0.1', ADMIN_DB_PATH: dbPath,
  SITE_DATA_DIR: dataDir, UPLOAD_DIR: path.join(tmp, 'uploads'), ADMIN_BOOTSTRAP_USER: 'fixture', ADMIN_BOOTSTRAP_PASS: password,
} })
let logs = '', cookie = '', db
child.stdout.on('data', b => { logs += b })
child.stderr.on('data', b => { logs += b })
async function req(url, method = 'GET', body, session = cookie, headers = {}) {
  const r = await fetch(`http://127.0.0.1:${port}${url}`, { method, headers: { 'Content-Type': 'application/json', Cookie: session, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0], data: await r.json().catch(() => null) }
}
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('isolated admin failed: ' + logs)
    try { ready = (await req('/health')).status === 200 } catch {}
    if (ready) break
    await new Promise(r => setTimeout(r, 50))
  }
  assert.ok(ready)
  db = new Database(dbPath)
  cookie = (await req('/api/admin/login', 'POST', { username: 'fixture', password })).cookie
  assert.equal((await req('/api/admin/apps', 'POST', { name: 'blocked' })).status, 403)
  assert.equal((await req('/api/admin/site-config')).status, 403)
  assert.equal((await req('/api/admin/me')).status, 200)
  console.log('PASS forced password enforcement on real read/write APIs')
  const second = (await req('/api/admin/login', 'POST', { username: 'fixture', password })).cookie
  const next = crypto.randomBytes(24).toString('hex')
  assert.equal((await req('/api/admin/change-password', 'POST', { oldPassword: password, newPassword: next })).status, 200)
  assert.equal((await req('/api/admin/me', 'GET', undefined, second)).status, 401)
  assert.equal((await req('/api/admin/me')).status, 401)
  cookie = (await req('/api/admin/login', 'POST', { username: 'fixture', password: next })).cookie
  assert.equal((await req('/api/admin/apps')).status, 200)
  console.log('PASS password change revokes every prior session')
  const fixtureAdmin = db.prepare('SELECT id FROM admins WHERE username=?').get('fixture').id
  db.transaction(() => {
    db.prepare('UPDATE admins SET active=0 WHERE id=?').run(fixtureAdmin)
    db.prepare('DELETE FROM sessions WHERE admin_id=?').run(fixtureAdmin)
  })()
  assert.equal((await req('/api/admin/me')).status, 401)
  assert.equal((await req('/api/admin/login', 'POST', { username: 'fixture', password: next })).status, 401)
  db.prepare('UPDATE admins SET active=1 WHERE id=?').run(fixtureAdmin)
  cookie = (await req('/api/admin/login', 'POST', { username: 'fixture', password: next })).cookie
  assert.equal((await req('/api/admin/apps')).status, 200)
  console.log('PASS contained administrator cannot authenticate or reuse old sessions')
  db.prepare('UPDATE admins SET totp_enabled=1,totp_secret=?').run('JBSWY3DPEHPK3PXP')
  assert.equal((await req('/api/admin/totp/setup', 'POST', {})).status, 409)
  assert.equal(db.prepare('SELECT totp_enabled FROM admins').get().totp_enabled, 1)
  assert.equal(db.prepare('SELECT totp_secret FROM admins').get().totp_secret, 'JBSWY3DPEHPK3PXP')
  console.log('PASS active TOTP cannot be replaced or disabled by setup')
  const { clientIp } = await import(pathToFileURL(path.join(dir, 'lib/auth.mjs')))
  assert.equal(clientIp({ ip: '192.0.2.1', headers: { 'x-forwarded-for': '198.51.100.1' } }), '192.0.2.1')
  for (let i = 0; i < 9; i++) {
    const r = await req('/api/admin/login', 'POST', { username: 'fixture', password: 'incorrect' }, '', { 'X-Forwarded-For': '192.0.2.2' })
    assert.equal(r.status, i < 8 ? 401 : 429)
  }
  console.log('PASS limiter key uses framework IP; repeated trusted-proxy IP is limited')
  assert.equal((await req('/data/config.json.bak')).status, 404)
  assert.equal((await req('/data/config.json')).status, 200)
  console.log('PASS exact public data allowlist blocks backups')
  const ordinary = await req('/api/public/customers/claim', 'POST', { deviceFp: 'fp-fixture-ordinary' }, '')
  assert.equal(ordinary.status, 200)
  assert.equal((await req('/api/public/customers/claim', 'POST', { deviceFp: 'seed:1000147271297' }, '')).status, 403)
  const fixtureToken = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO customer_tokens VALUES (?,?,?)').run(fixtureToken, 'DW1000147271297', new Date().toISOString())
  assert.equal((await req('/api/public/customers/me?token=' + fixtureToken)).status, 404)
  assert.equal((await req('/api/public/customers/claim', 'POST', { deviceFp: 'fp-other-fixture', cardToken: fixtureToken }, '')).status, 403)
  const again = await req('/api/public/customers/claim', 'POST', { deviceFp: 'fp-fixture-ordinary', cardToken: ordinary.data.token }, '')
  assert.equal(again.data.customerId, ordinary.data.customerId)
  assert.equal(again.data.cardNo, ordinary.data.cardNo)
  console.log('PASS seed identity denied; ordinary customer identity preserved')
  db.exec("CREATE TRIGGER audit_fixture_failure BEFORE INSERT ON operation_logs BEGIN SELECT RAISE(ABORT, 'fixture log unavailable'); END")
  for (const [url, method, payload] of [
    ['/api/admin/apps', 'POST', { name: 'audit-warning-fixture', url: 'https://example.invalid' }],
    ['/api/admin/apps/audit-warning-fixture', 'PUT', { name: 'audit-warning-fixture', url: 'https://example.invalid/updated' }],
    ['/api/admin/slots/afterEnterApp', 'PUT', { items: [] }],
    ['/api/admin/publish', 'POST', {}],
    ['/api/admin/apps/audit-warning-fixture', 'DELETE', undefined],
  ]) {
    const saved = await req(url, method, payload)
    assert.equal(saved.status, 200, method + ' committed despite audit failure')
    assert.equal(saved.data.ok, true)
    assert.equal(saved.data.auditWarning, true)
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'draft/config.json'))).apps.some(a => a.name === 'audit-warning-fixture'), false)
  assert.equal((await req('/data/config.json')).data.apps.some(a => a.name === 'audit-warning-fixture'), false, 'delete is already live even when its audit log fails')
  db.exec('DROP TRIGGER audit_fixture_failure')
  console.log('PASS actual CRUD/publish returns committed success with auditWarning when the operation log fails')
  let handler, gatewayCalls = 0
  const source = fs.readFileSync(path.join(root, 'deploy/najin-pay-bff.mjs'), 'utf8').replace(/^#![^\n]*\n/, '').replace(/^import .*$/mg, '')
  const ctx = { crypto, http: { createServer: f => { handler = f; return { listen() {} } } }, URL, URLSearchParams, AbortSignal, Buffer,
    process: { env: { NAJIN_MCH_ID: '1', NAJIN_KEY: 'test-only-key' } }, console: { log() {}, error() {} },
    fetch: async () => { gatewayCalls++; return { json: async () => ({ retCode: 'SUCCESS', status: 0 }) } } }
  vm.createContext(ctx)
  vm.runInContext(source + '\nglobalThis.create=handleCreate;globalThis.query=handleQuery;', ctx)
  const create = await ctx.create({ productId: 8009, amount: 10, kind: 'vip' }, '*')
  assert.equal(create.status, 503)
  assert.equal(create.data.code, 'PAYMENT_DISABLED')
  assert.equal(gatewayCalls, 0)
  assert.equal((await ctx.query({ mchOrderNo: 'old-fixture-order' }, '*')).status, 200)
  assert.equal(gatewayCalls, 1)
  console.log('PASS payment creation fails closed without gateway access; old-order query retained')
} finally {
  db?.close()
  child.kill()
  await new Promise(r => child.exitCode !== null ? r() : child.once('exit', r))
  if (path.dirname(tmp) !== os.tmpdir() || !path.basename(tmp).startsWith('joker-security-')) throw new Error('Unexpected fixture path')
  fs.rmSync(tmp, { recursive: true, force: true })
}
