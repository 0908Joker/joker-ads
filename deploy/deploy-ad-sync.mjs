// Deploy a narrow patch onto the verified live baseline. Never rebuild the
// historical frontend or copy bundled site-data over operator-managed data.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const oldBundle = 'index-server-46d1d07f01e5.js'
const newBundle = 'index-server-ce82a760c7a1.js'
const oldHash = '46d1d07f01e5f8f1589a9deec4460e43f458f28f9f24b00f79bf5d892b831d08'
const newHash = 'ce82a760c7a123aa8e911ce8ac128304b4aa821de594adea894553308260932c'
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const read = file => fs.readFileSync(file, 'utf8')
function once(text, before, after) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  before = before.replace(/\n/g, eol)
  after = after.replace(/\n/g, eol)
  if (!text.includes(before) && text.split(after).length === 2) return text
  assert.equal(text.split(before).length, 2, `Unexpected baseline: ${before.slice(0, 90)}`)
  return text.replace(before, after)
}

export function patchBundle(code) {
  if (digest(code) === newHash) return code
  assert.equal(digest(code), oldHash, 'Refuse to replace an unknown frontend build')
  for (const [before, after] of [
    ['const y=c.value.afterEnterApp||[];return y.length?y:', 'const y=c.value.afterEnterApp;return Array.isArray(y)?y:'],
    ['await jn(U.coverUrl||U.image)', 'await jn(U.image||U.coverUrl)'],
    ['class:"grid-ad__img",path:U.coverUrl', 'class:"grid-ad__img",path:U.image||U.coverUrl'],
  ]) code = once(code, before, after)
  assert.equal(digest(code), newHash)
  return code
}

export function patchServer(code) {
  if (!code.includes("import { addAppPlacement, updateAppPlacements } from './lib/appPlacements.mjs'")) {
    code = once(code, "import multer from 'multer'", "import multer from 'multer'\nimport { addAppPlacement, updateAppPlacements } from './lib/appPlacements.mjs'")
  }
  code = once(code, "    icon: String(appItem.icon || '/icons/placeholder.png'),\n  })\n  saveBundle('config', bundle.config)", "    icon: String(appItem.icon || '/icons/placeholder.png'),\n  })\n  addAppPlacement(bundle.config, name)\n  saveBundle('config', bundle.config)")
  if (!code.includes("if (!nextName) return res.status(400)")) {
    code = once(code, "  const nextName = String(body.name || oldName).trim()", "  const nextName = String(body.name || oldName).trim()\n  if (!nextName) return res.status(400).json({ error: '请填写应用名称' })\n  if (nextName !== oldName && bundle.config.apps.some((a) => a.name === nextName)) {\n    return res.status(409).json({ error: '应用名称已存在' })\n  }")
  }
  code = once(code, "    name: nextName,\n  }\n  saveBundle('config', bundle.config)", "    name: nextName,\n  }\n  if (nextName !== oldName) updateAppPlacements(bundle.config, oldName, nextName)\n  saveBundle('config', bundle.config)")
  code = once(code, "  bundle.config.apps = (bundle.config.apps || []).filter((a) => a.name !== name)\n  saveBundle('config', bundle.config)", "  bundle.config.apps = (bundle.config.apps || []).filter((a) => a.name !== name)\n  updateAppPlacements(bundle.config, name)\n  saveBundle('config', bundle.config)")
  return code
}

export function patchNginx(code) {
  if (!code.includes('location ^~ /data/')) {
    code = once(code, `    location /data/ {
        alias /opt/ads-king/site-data/live/;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Access-Control-Allow-Origin "*";
        default_type application/json;
    }`, `    location ^~ /data/ {
        if ($uri !~ "^/data/(config|popups|tabs|meta|api-session)\\.json$") { return 404; }
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache off;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Access-Control-Allow-Origin "*" always;
    }`)
  }
  assert.ok(code.includes('proxy_pass http://127.0.0.1:8790;'))
  assert.ok(code.includes('^/data/(config|popups|tabs|meta|api-session)\\.json$'))
  return once(code, '    location /uploads/ {', '    location ^~ /uploads/ {')
}

function atomic(file, content) {
  const tmp = file + '.ad-sync-new'
  fs.writeFileSync(tmp, content, { mode: 0o644 })
  fs.renameSync(tmp, file)
}

async function deploy(revision) {
  assert.match(revision, /^[a-f0-9]{40}$/)
  const web = '/www/wwwroot/b12sl5x.cn'
  const admin = '/opt/ads-king/admin'
  const nginx = '/www/server/panel/vhost/nginx/b12sl5x.cn.conf'
  const backup = `/opt/ads-king/backups/ad-sync-${revision}-${Date.now()}`
  const indexFile = path.join(web, 'index.html')
  const index = read(indexFile)
  const active = index.includes('/assets/' + newBundle) ? newBundle : oldBundle
  assert.equal(index.split('/assets/' + active).length, 2)
  const code = patchBundle(read(path.join(web, 'assets', active)))
  const files = [
    [path.join(admin, 'server.mjs'), patchServer(read(path.join(admin, 'server.mjs')))],
    [path.join(admin, 'lib/appPlacements.mjs'), read(path.join(repo, 'admin/lib/appPlacements.mjs'))],
    [nginx, patchNginx(read(nginx))],
    [indexFile, index.replace('/assets/' + active, '/assets/' + newBundle)],
  ]
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 })
  const changed = files.filter(([file, content]) => !fs.existsSync(file) || read(file) !== content)
  const saved = changed.map(([file], i) => {
    const previous = fs.existsSync(file) ? fs.readFileSync(file) : null
    if (previous) fs.writeFileSync(path.join(backup, `${i}.before`), previous, { mode: 0o600 })
    return { file, previous }
  })
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ revision, files: saved.map(({file}, i) => ({ file, before: `${i}.before` })) }, null, 2))
  try {
    atomic(path.join(web, 'assets', newBundle), code)
    for (const [file, content] of changed) atomic(file, content)
    execFileSync(process.execPath, ['--check', path.join(admin, 'server.mjs')])
    execFileSync('nginx', ['-t'], { stdio: 'inherit' })
    if (changed.some(([file]) => file.startsWith(admin))) execFileSync('systemctl', ['restart', 'ads-king-admin'])
    if (changed.some(([file]) => file === nginx)) execFileSync('systemctl', ['reload', 'nginx'])
    let healthy = false
    for (let i = 0; i < 30; i++) {
      try { healthy = (await fetch('http://127.0.0.1:8790/health')).ok } catch {}
      if (healthy) break
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    assert.ok(healthy, 'admin health after release')
    execFileSync(process.execPath, [path.join(repo, 'scripts/test-ad-sync.mjs')], {
      stdio: 'inherit', env: { ...process.env, AD_SYNC_ADMIN_DIR: admin, AD_SYNC_BROWSER_BUNDLE: '' },
    })
    for (const name of ['config', 'popups', 'tabs', 'meta']) {
      const response = await fetch(`https://b12sl5x.cn/data/${name}.json?release=${revision}`)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('cache-control'), /no-store/)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(`/opt/ads-king/site-data/live/${name}.json`))
    }
    const publicJS = await fetch('https://b12sl5x.cn/assets/' + newBundle)
    assert.equal(publicJS.status, 200)
    assert.equal(digest(Buffer.from(await publicJS.arrayBuffer())), newHash)
    assert.ok((await (await fetch('https://b12sl5x.cn/?release=' + revision)).text()).includes('/assets/' + newBundle))
    const receipt = { revision, deployedAt: new Date().toISOString(), frontend: newBundle, frontendSha256: newHash, backendSha256: digest(read(path.join(admin, 'server.mjs'))), status: 'verified', backup }
    fs.writeFileSync(path.join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2))
    atomic(path.join(web, 'deployment.json'), JSON.stringify({ ...receipt, backup: undefined }, null, 2) + '\n')
    console.log(JSON.stringify(receipt))
  } catch (error) {
    for (const { file, previous } of saved.reverse()) {
      if (previous) atomic(file, previous)
      // An unused additive helper is safe to retain when reverting the importer.
    }
    execFileSync('systemctl', ['restart', 'ads-king-admin'])
    execFileSync('nginx', ['-t'], { stdio: 'inherit' })
    execFileSync('systemctl', ['reload', 'nginx'])
    throw error
  }
}

if (process.argv[2] === '--verify-bundle') {
  const patched = patchBundle(read(process.argv[3]))
  assert.equal(patchBundle(patched), patched)
  console.log('PASS: reproducible ad-sync production bundle ' + digest(patched))
} else if (process.argv[2] === '--deploy') {
  throw new Error('Legacy one-off deploy is retired. Use the manifest-based production workflow.')
}
