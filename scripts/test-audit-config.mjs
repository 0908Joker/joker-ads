// Faults exercise the actual store against disposable directories, not a model.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const adminDir = process.env.AUDIT_ADMIN_DIR || path.join(root, 'admin')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-config-'))
process.env.SITE_DATA_DIR = tmp
process.env.UPLOAD_DIR = path.join(tmp, 'uploads')
const base = { config: { apps: [{ name: 'OLD', url: 'https://example.com/old' }] }, popups: { afterEnterApp: [] }, tabs: { mine: { quickApps: [] } }, apiSession: {}, meta: { version: 9 } }
const files = { config: 'config', popups: 'popups', tabs: 'tabs', apiSession: 'api-session', meta: 'meta' }
for (const stage of ['live', 'draft']) {
  fs.mkdirSync(path.join(tmp, stage))
  for (const [key, file] of Object.entries(files)) fs.writeFileSync(path.join(tmp, stage, file + '.json'), JSON.stringify(base[key]))
}
const snapshot = path.join(tmp, 'published.json')
const draft = name => path.join(tmp, 'draft', name + '.json')
fs.writeFileSync(draft('config'), JSON.stringify({ apps: [{ name: 'NEW' }] }))
try {
  const store = await import(pathToFileURL(path.join(adminDir, 'lib/jsonStore.mjs')))
  assert.deepEqual(store.readPublished(), base, 'Migration imports live only, never pending draft')
  const before = fs.readFileSync(snapshot, 'utf8')
  fs.writeFileSync(draft('tabs'), '{broken')
  assert.throws(() => store.publishAll(), /无法读取或解析/)
  assert.equal(fs.readFileSync(snapshot, 'utf8'), before)
  fs.writeFileSync(draft('tabs'), JSON.stringify(base.tabs))
  for (const invalid of [{ apps: {} }, {}, { apps: [], categoryApps: { byCategory: { bad: {} } } }]) {
    fs.writeFileSync(draft('config'), JSON.stringify(invalid))
    assert.throws(() => store.publishAll(), error => error.status === 400)
    assert.equal(fs.readFileSync(snapshot, 'utf8'), before)
  }
  fs.writeFileSync(draft('config'), JSON.stringify({ apps: [{ name: 'NEW' }], extension: { kept: true } }))
  const childScript = `
    import fs from 'node:fs'
    const target = process.env.SITE_DATA_DIR + '/published.json'
    const mode = process.env.AUDIT_FAULT
    const store = await import(process.env.AUDIT_STORE_URL)
    if (mode === 'write' || mode === 'sync' || mode === 'backup') {
      const key = {write:'writeFileSync',sync:'fsyncSync',backup:'copyFileSync'}[mode]
      fs[key] = () => { throw new Error('injected ' + mode) }
    }
    const rename = fs.renameSync
    fs.renameSync = (from, to) => {
      if (String(to).replaceAll('\\\\','/') === target.replaceAll('\\\\','/')) {
        if (mode === 'rename') throw new Error('injected rename')
        if (mode === 'kill-before') process.exit(23)
        const result = rename(from, to)
        if (mode === 'kill-after') process.exit(23)
        return result
      }
      return rename(from, to)
    }
    store.publishAll()
  `
  for (const fault of ['write', 'sync', 'backup', 'rename', 'kill-before', 'kill-after']) {
    fs.writeFileSync(snapshot, before)
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], { env: { ...process.env, AUDIT_FAULT: fault, AUDIT_STORE_URL: pathToFileURL(path.join(adminDir, 'lib/jsonStore.mjs')).href }, encoding: 'utf8' })
    assert.notEqual(child.status, 0, fault)
    const actual = JSON.parse(fs.readFileSync(snapshot))
    if (fault === 'kill-after') {
      assert.equal(actual.config.apps[0].name, 'NEW')
      assert.equal(actual.meta.version, 10)
      assert.deepEqual(actual.tabs, base.tabs)
    } else assert.deepEqual(actual, base, fault + ' preserves all-old snapshot')
    console.log('PASS atomic fault ' + fault)
  }
  fs.writeFileSync(snapshot, before)
  const committed = store.publishAll()
  assert.equal(committed.version, 10)
  assert.equal(store.readLive('config.json').extension.kept, true)
  store.publishApiSession({ token: 'isolated-fixture', uid: 'fixture' })
  assert.equal(store.readPublished().meta.version, 11)
  assert.equal(store.readPublished().config.apps[0].name, 'NEW')
  fs.writeFileSync(draft('config'), JSON.stringify({ apps: [] }))
  store.syncDraftFromLive()
  assert.equal(store.readDraft('config.json').apps[0].name, 'NEW')
  assert.equal(fs.existsSync(path.join(tmp, 'live/config.json.bak')), false)
  console.log('PASS live-only migration; corrupt/invalid draft rejected; unknown fields retained; session commit; discard from snapshot')
} finally { fs.rmSync(tmp, { recursive: true, force: true }) }
