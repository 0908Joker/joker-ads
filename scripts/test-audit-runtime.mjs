// Execute the exact patched production functions with controllable media/network primitives.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { parse } from '@babel/parser'
import { createPlaybackSession } from '../src/lib/playbackSession.js'
const dir = path.resolve(process.env.AUDIT_BUNDLE_OUT || 'dist/audit-release')
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')))
assert.ok(manifest.stage >= 3)
const code = fs.readFileSync(path.join(dir, manifest.frontend), 'utf8')
const ast = parse(code, { sourceType: 'module' })
const helper = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'auditPlayback')
assert.ok(helper)
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
for (const [label, functionCode, name] of [['source', createPlaybackSession.toString(), 'createPlaybackSession'], ['shipped', code.slice(helper.start, helper.end), 'auditPlayback']]) {
  const timers = new Map(); let timerId = 0
  const ctx = vm.createContext({ setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id) })
  vm.runInContext(functionCode, ctx)
  const create = ctx[name]
  let sequence = 1
  const urls = [], listeners = new Map(), instances = []
  const video = { src: '', pause() {}, removeAttribute() { this.src = '' }, load() { if (this.src) urls.push(this.src) }, play: () => Promise.resolve(),
    canPlayType: () => true, addEventListener(event, callback) { listeners.set(event, callback) }, removeEventListener(event, callback) { if (listeners.get(event) === callback) listeners.delete(event) } }
  class Hls {
    static Events = { MANIFEST_PARSED: 'ready', ERROR: 'error' }
    static isSupported() { return true }
    constructor() { this.handlers = {}; this.destroyed = 0; instances.push(this) }
    on(event, fn) { this.handlers[event] = fn }
    off(event, fn) { if (this.handlers[event] === fn) delete this.handlers[event] }
    loadSource(url) { this.url = url }
    attachMedia() {}
    destroy() { this.destroyed++ }
  }
  let loader = () => Promise.resolve({ default: Hls })
  const player = create({ getVideo: () => video, getSequence: () => sequence, loadHls: () => loader() })
  const first = player.attachCandidates(['A.m3u8', 'A-backup.mp4'], sequence)
  await tick()
  const a = instances[0], delayedError = a.handlers.error
  sequence++
  player.dispose()
  const second = player.attachCandidates(['B.m3u8'], sequence)
  await tick()
  const b = instances[1]
  b.handlers.ready()
  assert.equal(await second, true)
  delayedError('', { fatal: true })
  assert.equal(await first, false)
  assert.equal(b.destroyed, 0, 'old A cannot destroy B')
  assert.equal(a.destroyed, 1)
  assert.equal(urls.includes('A-backup.mp4'), false)
  player.dispose()
  assert.equal(b.destroyed, 1)
  const hangingImport = deferred()
  loader = () => hangingImport.promise
  sequence++
  const importing = player.attachCandidates(['delayed.m3u8'], sequence)
  await tick()
  sequence++
  player.dispose()
  const fresh = player.attachCandidates(['new.mp4'], sequence)
  listeners.get('loadeddata')()
  assert.equal(await fresh, true)
  hangingImport.resolve({ default: Hls })
  assert.equal(await importing, false)
  await tick()
  assert.equal(video.src, 'new.mp4')
  assert.equal(instances.length, 2, 'late dynamic import cannot allocate a stale player')
  player.dispose()
  sequence++
  const timeout = player.attachCandidates(['hang.mp4', 'fallback.mp4'], sequence)
  const task = [...timers.values()][0]
  assert.equal(task.delay, 10000, 'each candidate has a ten-second deadline')
  task.fn()
  await tick()
  assert.equal(video.src, 'fallback.mp4')
  listeners.get('loadeddata')()
  assert.equal(await timeout, true)
  sequence++
  const leaving = player.attachCandidates(['leaving.mp4', 'must-not-play.mp4'], sequence)
  sequence++ // The component's before-unmount hook invalidates work before disposal.
  player.dispose()
  assert.equal(await leaving, false)
  assert.equal(listeners.size, 0)
  assert.equal(timers.size, 0)
  assert.equal(urls.includes('must-not-play.mp4'), false)
  console.log('PASS ' + label + ': A→B delayed fatal; stale import; bounded fallback; unmount; owned listeners/timers')
}
let relatedNode
function visit(node) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'ObjectExpression' && node.properties.some(p => p.key?.name === '__name' && p.value?.value === 'PlayPage')) {
    relatedNode = node.properties.find(p => p.key?.name === 'setup').body.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 's')
  }
  for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v)
}
visit(ast)
assert.ok(relatedNode)
const pending = deferred(), state = { value: [] }
const ctx = vm.createContext({ p: state, r: 1, bt: 12, C: (list, id) => list.filter(v => v.id !== id), Wp: () => pending.promise, R0: value => value })
vm.runInContext(code.slice(relatedNode.start, relatedNode.end), ctx)
const aRelated = ctx.s('A', [], 1)
ctx.r = 2
const expected = Array.from({ length: 12 }, (_, i) => ({ id: 'B-' + i }))
await ctx.s('B', expected, 2)
pending.resolve({ data: Array.from({ length: 12 }, (_, i) => ({ id: 'A-' + i })) })
await aRelated
assert.deepEqual(JSON.parse(JSON.stringify(state.value)), expected)
assert.ok(code.includes('En(()=>{++r;m()})'), 'shipped unmount invalidates sequence')
console.log('PASS shipped related recommendations reject delayed previous generation; unmount hook wired')
