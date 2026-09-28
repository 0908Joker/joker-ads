// Execute the actual generated URL/redirect code with controlled browser inputs.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const root = path.resolve(process.argv[2] || 'crawled/_production-entry/release')
const record = JSON.parse(fs.readFileSync(path.join(root, 'release.json')))
const js = fs.readFileSync(path.join(root, 'main/assets', record.javascript), 'utf8')
const readScript = file => [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n')
const helpers = js.slice(js.indexOf('function serverInviteTarget('), js.lastIndexOf('serverLegacyInvite()||Uu();'))
const uf = js.slice(js.indexOf('function Uf('), js.indexOf('function ya('))
const share = js.slice(js.indexOf('function ya('), js.indexOf('function kf('))
assert(helpers && uf && share)
for (const [url, expected, claims] of [
  ['https://b12sl5x.cn/#/invite?inviteCode=123', 'http://okqpkdj.cn/?inviteCode=123', 0],
  ['https://b12sl5x.cn/?inviteCode=outer#/invite?inviteCode=inner', 'http://okqpkdj.cn/?inviteCode=outer', 0],
  ['https://b12sl5x.cn/#/invite', 'http://okqpkdj.cn/', 0],
  ['https://b12sl5x.cn/invite?inviteCode=123', 'http://okqpkdj.cn/?inviteCode=123', 0],
  ['https://b12sl5x.cn/#/appcenter?inviteCode=123', null, 1],
  ['https://b12sl5x.cn/#/my', null, 1],
]) {
  let redirect = null, started = 0
  const location = new URL(url)
  location.replace = target => { redirect = target }
  vm.runInNewContext(uf + helpers + 'serverLegacyInvite()||Uu();', { URL, URLSearchParams, location, Uu: () => { started++ } })
  assert.equal(redirect, expected)
  assert.equal(started, claims, 'Old route must never start the claim lifecycle')
}
for (const code of ['', '123', 'a+b/&? 中文']) {
  const anchor = { href: '' }
  vm.runInNewContext(readScript('landing/index.html'), { URL, URLSearchParams, location: { search: code ? '?' + new URLSearchParams({ inviteCode: code }) : '' }, document: { querySelector: () => anchor } })
  const h5Url = new URL(anchor.href)
  assert.equal(h5Url.origin + h5Url.pathname, 'https://b12sl5x.cn/h5/')
  assert.equal(h5Url.searchParams.get('inviteCode'), code || '1110333149523')
  let timer, delay, finalUrl
  vm.runInNewContext(readScript('main/h5/index.html'), { URL, URLSearchParams, location: { search: h5Url.search, replace: value => { finalUrl = value } }, setTimeout: (fn, ms) => { timer = fn; delay = ms } })
  assert.equal(delay, 2000)
  assert.equal(finalUrl, undefined)
  timer()
  const final = new URL(finalUrl)
  assert.equal(final.origin, 'https://b12sl5x.cn')
  assert(final.hash.startsWith('#/appcenter?'))
  assert.equal(new URLSearchParams(final.hash.split('?')[1]).get('inviteCode'), code || '1110333149523')
  const shared = vm.runInNewContext(helpers + share + 'ya("' + (code ? '123' : '') + '")', { URL, URLSearchParams, He: { inviteCode: 'existing-card' } })
  assert.equal(new URL(shared).searchParams.get('inviteCode'), code ? '123' : 'existing-card')
}
let noCodeTarget
vm.runInNewContext(readScript('main/h5/index.html'), { URL, URLSearchParams, location: { search: '', replace: url => { noCodeTarget = url } }, setTimeout: fn => fn() })
assert.equal(noCodeTarget, 'https://b12sl5x.cn/#/appcenter')
assert(!js.includes('__name:"InvitePage"'))
assert(!/dewu-hero.*?\.mp4/.test(js))
console.log('PASS: old links bypass claim; referral survives landing/H5; 2-second replace; direct H5 stays unbound; share URLs use landing; no old showcase/video')
