import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { digest, patchAuditFrontend } from './audit-frontend.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseline = process.argv[2]
const out = path.resolve(process.argv[3] || path.join(root, 'dist/audit-release'))
const config = JSON.parse(fs.readFileSync(path.join(root, 'deploy/audit-release.json')))
const contract = JSON.parse(fs.readFileSync(path.join(root, 'deploy/audit-source-contract.json')))
for (const [file, sha] of Object.entries(contract)) assert.equal(digest(fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')), sha, 'Source contract changed without a runtime patch: ' + file)
const code = patchAuditFrontend(fs.readFileSync(baseline, 'utf8'), config.stage)
const frontendSha256 = digest(code)
const frontend = `index-audit-${config.stage}-${frontendSha256.slice(0, 12)}.js`
const files = ['admin/server.mjs', ...fs.readdirSync(path.join(root, 'admin/lib')).filter(n => n.endsWith('.mjs')).map(n => 'admin/lib/' + n),
  'admin/public/admin.js', 'admin/public/index.html', 'admin/public/admin.css', 'deploy/najin-pay-bff.mjs']
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, frontend), code)
const manifest = { schema: 1, stage: config.stage, frontend, frontendSha256,
  sourceDigest: digest(JSON.stringify(contract)), files: files.map(file => ({ source: file,
    target: file.startsWith('admin/') ? '/opt/ads-king/' + file : '/opt/ads-king/najin-pay-bff.mjs',
    sha256: digest(fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')) })) }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log('PASS audited release manifest ' + JSON.stringify({ stage: config.stage, frontend, frontendSha256, files: manifest.files.length }))
