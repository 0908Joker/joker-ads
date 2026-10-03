// Manifest-based deployment, called only by the project's restricted CI key.
// Operator data and customer databases are never copied from this checkout.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const read = file => fs.readFileSync(file, 'utf8')
function atomic(file, data, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.audit-new'
  const fd = fs.openSync(tmp, 'w', mode)
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(tmp, file)
}
export function patchIngress(code, shared = false, bundle = false) {
  if (shared) {
    const start = code.indexOf('location = /m3u8-proxy {')
    const end = code.indexOf('\n# Najin', start)
    assert.ok(start >= 0 && end > start, 'Known unused proxy block required')
    return code.slice(0, start) + 'location = /m3u8-proxy { return 403; }\n' + code.slice(end)
  }
  code = code.replaceAll('X-Forwarded-For $proxy_add_x_forwarded_for', 'X-Forwarded-For $remote_addr')
  if (bundle) code = code.replaceAll('(config|popups|tabs|meta|api-session)', '(config|popups|tabs|meta|api-session|site-bundle)')
  if (!code.includes('location ^~ /data/')) {
    const marker = '    location / {\n        proxy_pass http://127.0.0.1:8790;'
    assert.equal(code.split(marker).length, 2)
    code = code.replace(marker, '    location ^~ /data/ {\n        if ($uri !~ "^/data/(config|popups|tabs|meta|api-session' + (bundle ? '|site-bundle' : '') + ')\\.json$") { return 404; }\n        proxy_pass http://127.0.0.1:8790;\n        add_header Cache-Control "no-store" always;\n    }\n\n' + marker)
  }
  return code
}

async function deploy(revision, out) {
  assert.match(revision, /^[a-f0-9]{40}$/)
  const manifest = JSON.parse(read(path.join(out, 'manifest.json')))
  const baseline = JSON.parse(read(path.join(root, 'deploy/audit-baseline.json')))
  const web = '/www/wwwroot/b12sl5x.cn', receiptFile = web + '/deployment.json'
  const previous = JSON.parse(read(receiptFile))
  if (previous.sourceDigest && previous.sourceDigest !== manifest.sourceDigest) assert.notEqual(previous.frontendSha256, manifest.frontendSha256, 'Changed frontend source must produce a changed runtime artifact')
  const expected = { ...baseline, ...Object.fromEntries((previous.files || []).map(f => [f.target, f.sha256])) }
  const ingressPaths = ['/www/server/panel/vhost/nginx/b12sl5x.cn.conf', '/www/server/panel/vhost/nginx/admin.b12sl5x.cn.conf', '/www/server/panel/vhost/nginx/extension/seduoduo.cc/ads-king-proxy.conf']
  const operations = manifest.files.map(item => {
    assert.match(item.source, /^(admin\/(server\.mjs|lib\/[\w-]+\.mjs|public\/(admin\.(js|css)|index\.html))|deploy\/najin-pay-bff\.mjs)$/)
    const target = item.source.startsWith('admin/') ? '/opt/ads-king/' + item.source : '/opt/ads-king/najin-pay-bff.mjs'
    assert.equal(item.target, target)
    const data = read(path.join(root, item.source)).replaceAll('\r\n', '\n')
    assert.equal(sha(data), item.sha256)
    return { ...item, data, sticky: target.endsWith('/najin-pay-bff.mjs') }
  })
  for (const [i, target] of ingressPaths.entries()) operations.push({ target, data: patchIngress(read(target), i === 2, manifest.stage >= 2), sticky: true })
  for (const item of operations) {
    item.before = fs.existsSync(item.target) ? fs.readFileSync(item.target) : null
    if (item.before) assert.equal(sha(item.before), expected[item.target], 'Unexpected runtime drift: ' + item.target)
    else assert.equal(expected[item.target], undefined, 'Expected runtime file missing: ' + item.target)
    item.sha256 = sha(item.data)
  }
  const indexFile = web + '/index.html', index = read(indexFile)
  assert.equal(index.split('/assets/' + previous.frontend).length, 2)
  assert.equal(sha(fs.readFileSync(web + '/assets/' + previous.frontend)), previous.frontendSha256)
  const bundle = fs.readFileSync(path.join(out, manifest.frontend))
  assert.equal(sha(bundle), manifest.frontendSha256)
  if (manifest.stage >= 3) execFileSync(process.execPath, [path.join(root, 'scripts/test-audit-runtime.mjs')], { stdio: 'inherit', env: { ...process.env, AUDIT_BUNDLE_OUT: out } })
  const backup = '/opt/ads-king/backups/audit-' + manifest.stage + '-' + revision + '-' + Date.now()
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 })
  for (const [i, op] of operations.entries()) if (op.before) fs.writeFileSync(path.join(backup, i + '.before'), op.before, { mode: 0o600 })
  fs.writeFileSync(backup + '/index.before', index, { mode: 0o600 })
  fs.writeFileSync(backup + '/receipt.before', read(receiptFile), { mode: 0o600 })
  const publishedFile = '/opt/ads-king/site-data/published.json'
  if (fs.existsSync(publishedFile)) fs.writeFileSync(backup + '/published.before.json', fs.readFileSync(publishedFile), { mode: 0o600 })
  fs.writeFileSync(backup + '/rollback.json', JSON.stringify({ revision, files: operations.map((o, i) => ({ target: o.target, before: o.before ? i + '.before' : null, sticky: o.sticky, beforeSha256: o.before ? sha(o.before) : null, afterSha256: o.sha256 })) }, null, 2), { mode: 0o600 })
  let ingressValidated = false
  try {
    for (const op of operations) atomic(op.target, op.data)
    for (const op of operations.filter(o => o.target.endsWith('.mjs') || o.target.endsWith('/admin.js'))) execFileSync(process.execPath, ['--check', op.target])
    execFileSync('nginx', ['-t'], { stdio: 'inherit' }); ingressValidated = true
    execFileSync('systemctl', ['restart', 'najin-pay', 'ads-king-admin'])
    execFileSync('systemctl', ['reload', 'nginx'])
    let healthy = false
    for (let i = 0; i < 40; i++) {
      try { healthy = (await fetch('http://127.0.0.1:8790/health')).ok && (await fetch('http://127.0.0.1:8787/pay-bff/health')).ok } catch {}
      if (healthy) break
      await new Promise(r => setTimeout(r, 200))
    }
    assert.ok(healthy, 'Both application services healthy')
    execFileSync(process.execPath, [path.join(root, 'scripts/test-audit-security.mjs')], { stdio: 'inherit', env: { ...process.env, AUDIT_ADMIN_DIR: '/opt/ads-king/admin' } })
    execFileSync(process.execPath, [path.join(root, 'scripts/test-ad-sync.mjs')], { stdio: 'inherit', env: { ...process.env, AD_SYNC_ADMIN_DIR: '/opt/ads-king/admin', AD_SYNC_BROWSER_BUNDLE: '' } })
    execFileSync(process.execPath, [path.join(root, 'scripts/test-audit-config.mjs')], { stdio: 'inherit', env: { ...process.env, AUDIT_ADMIN_DIR: '/opt/ads-king/admin' } })
    const newOrder = await fetch('https://b12sl5x.cn/pay-bff/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(newOrder.status, 503)
    assert.equal((await newOrder.json()).code, 'PAYMENT_DISABLED')
    assert.equal((await fetch('https://b12sl5x.cn/m3u8-proxy')).status, 403)
    for (const host of ['b12sl5x.cn', 'admin.b12sl5x.cn']) {
      assert.equal((await fetch('https://' + host + '/data/config.json.bak')).status, 404)
      assert.equal((await fetch('https://' + host + '/data/config.json')).status, 200)
      if (manifest.stage >= 2) {
        const published = await fetch('https://' + host + '/data/site-bundle.json')
        assert.equal(published.status, 200)
        const snapshot = await published.json()
        assert.ok(Array.isArray(snapshot.config.apps))
        assert.ok(Number.isSafeInteger(snapshot.meta.version))
      }
    }
    // Retain backups recoverably outside any HTTP data root.
    const live = '/opt/ads-king/site-data/live'
    for (const name of fs.readdirSync(live).filter(n => /^[\w.-]+\.(bak|tmp)$/.test(n))) {
      const target = path.join(backup, 'private-data-backups', name)
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
      fs.renameSync(path.join(live, name), target)
    }
    atomic(web + '/assets/' + manifest.frontend, bundle)
    atomic(indexFile, index.replace('/assets/' + previous.frontend, '/assets/' + manifest.frontend))
    const publicBundle = await fetch('https://b12sl5x.cn/assets/' + manifest.frontend)
    assert.equal(publicBundle.status, 200)
    assert.equal(sha(Buffer.from(await publicBundle.arrayBuffer())), manifest.frontendSha256)
    assert.ok((await (await fetch('https://b12sl5x.cn/?audit=' + revision)).text()).includes(manifest.frontend))
    for (const op of operations) assert.equal(sha(fs.readFileSync(op.target)), op.sha256, 'Runtime hash ' + op.target)
    const receipt = { ...manifest, revision, deployedAt: new Date().toISOString(), status: 'verified',
      files: operations.map(({ source, target, sha256 }) => ({ source, target, sha256 })) }
    fs.writeFileSync(backup + '/receipt.json', JSON.stringify(receipt, null, 2), { mode: 0o600 })
    atomic(receiptFile, JSON.stringify(receipt, null, 2) + '\n')
    console.log('DEPLOYED ' + JSON.stringify({ revision, stage: manifest.stage, frontendSha256: manifest.frontendSha256, backup, files: receipt.files.length }))
  } catch (error) {
    for (const op of [...operations].reverse()) {
      if (op.sticky && ingressValidated) continue
      if (op.before) atomic(op.target, op.before)
    }
    atomic(indexFile, index)
    execFileSync('nginx', ['-t'], { stdio: 'inherit' })
    execFileSync('systemctl', ['restart', 'ads-king-admin', 'najin-pay'])
    execFileSync('systemctl', ['reload', 'nginx'])
    console.error('ROLLED BACK application files; validated payment/proxy/data safety changes retained. Backup: ' + backup)
    throw error
  }
}
if (process.argv[2] === '--deploy') await deploy(process.argv[3], path.resolve(process.argv[4]))
