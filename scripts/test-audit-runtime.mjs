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
  const video = { src: '', readyState: 0, pause() {}, removeAttribute() { this.src = '' }, load() { this.readyState = 0; if (this.src) urls.push(this.src) }, play: () => Promise.resolve(),
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
  const fatalErrors = []
  const player = create({ getVideo: () => video, getSequence: () => sequence, loadHls: () => loader(), onError: e => fatalErrors.push(e.message) })
  const decoded = () => { video.readyState = 2; listeners.get('loadeddata')() }
  const first = player.attachCandidates(['A.m3u8', 'A-backup.mp4'], sequence)
  await tick()
  const a = instances[0], delayedError = a.handlers.error
  sequence++
  player.dispose()
  const second = player.attachCandidates(['B.m3u8'], sequence)
  await tick()
  const b = instances[1]
  let completedBeforeFrame = false
  second.then(() => { completedBeforeFrame = true })
  b.handlers.ready?.()
  await tick()
  assert.equal(completedBeforeFrame, false, 'manifest alone must not report decoded media')
  decoded()
  assert.equal(await second, true)
  assert.equal(typeof b.handlers.error, 'function', 'fatal listener retained after readiness')
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
  decoded()
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
  decoded()
  assert.equal(await timeout, true)
  sequence++
  const leaving = player.attachCandidates(['leaving.mp4', 'must-not-play.mp4'], sequence)
  sequence++ // The component's before-unmount hook invalidates work before disposal.
  player.dispose()
  assert.equal(await leaving, false)
  assert.equal(listeners.size, 0)
  assert.equal(timers.size, 0)
  assert.equal(urls.includes('must-not-play.mp4'), false)
  loader = () => Promise.resolve({ default: Hls })
  sequence++
  const late = player.attachCandidates(['late.m3u8', 'backup.mp4'], sequence)
  await tick()
  const live = instances.at(-1)
  decoded()
  assert.equal(await late, true)
  live.handlers.error('', { fatal: true })
  await tick()
  assert.equal(video.src, 'backup.mp4', 'late fatal switches to backup')
  decoded()
  await tick()
  listeners.get('error')()
  await tick()
  assert.equal(fatalErrors.length, 1, 'all exhausted candidates surface final failure')
  player.dispose()
  sequence++
  const beforeFrame = player.attachCandidates(['first.m3u8', 'first-backup.mp4'], sequence)
  await tick()
  instances.at(-1).handlers.error('', { fatal: true })
  await tick()
  assert.equal(video.src, 'first-backup.mp4')
  decoded()
  assert.equal(await beforeFrame, true)
  player.dispose()
  assert.equal(listeners.size, 0)
  assert.equal(timers.size, 0)
  console.log('PASS ' + label + ': decoded readiness; persistent fatal fallback; first-segment failure; A→B; stale import; ten-second deadline; final error; teardown')
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
assert.ok(code.includes('En(()=>{++r;loadController?.abort();m()})'), 'shipped unmount invalidates sequence and cancels requests')
console.log('PASS shipped related recommendations reject delayed previous generation; unmount hook wired')

function topFunction(name) {
  const node = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  assert.ok(node, name)
  return code.slice(node.start, node.end)
}
function componentFunctions(component) {
  let setup
  function scan(n) {
    if (!n || typeof n !== 'object') return
    if (n.type === 'ObjectExpression' && n.properties.some(p => p.key?.name === '__name' && p.value?.value === component)) { setup = n.properties.find(p => p.key?.name === 'setup').body; return }
    for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === 'object') scan(v)
  }
  scan(ast)
  assert.ok(setup, component)
  return name => { const n = setup.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); assert.ok(n, name); return code.slice(n.start, n.end) }
}
const { sourceFunction } = await import('../deploy/audit-frontend-stage2.mjs')
for (const variant of ['source','shipped']) {
  const timers = new Map(); let timerId = 0
  const calls = []
  let responder = async () => ({ ok: true, json: async () => ({ data: [] }) })
  const context = { AbortController, Promise, Date, Error,
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { calls.push({ url, signal: options.signal }); return responder(url, options) },
    activeBase:'fixture',na:'fixture',apiSid:'fixture',Z0:'fixture',lastFetchAt:null,auditLastFetchAt:null,
    requestPath:p=>p,Zo:p=>p,PID:'fixture',Bo:'fixture',authHeaders:()=>({}),Fo:()=>({}),
    isSidError:m=>m?.startsWith('fail/sid:'),ff:m=>m?.startsWith('fail/sid:'),
    unwrapApiPayload:j=>j.data,yf:j=>j.data }
  const vmctx=vm.createContext(context)
  const names=variant==='source' ? ['withRequestDeadline','fetchJsonTimed','refreshApiSid','apiFetch'] : ['auditDeadline','auditJSON','Zn','o0']
  const program=variant==='source'
    ? ['withRequestDeadline','fetchJsonTimed'].map(n=>sourceFunction('src/api/timedFetch.js',n)).concat(['refreshApiSid','apiFetch'].map(n=>sourceFunction('src/api/client.js',n))).join('\n')
    : names.map(topFunction).join('\n')
  vm.runInContext(program,vmctx)
  const request=vmctx[names[3]]
  responder=async()=>new Promise(()=>{})
  const hanging=request('/hang'), rejected=assert.rejects(hanging,/超时/)
  await tick()
  assert.equal(calls.length,1); assert.ok(calls[0].signal)
  const deadline=[...timers.values()].find(t=>t.delay===15000); assert.ok(deadline); deadline.fn()
  await rejected
  assert.equal(calls[0].signal.aborted,true); assert.equal(timers.size,0)
  calls.length=0
  responder=async()=>({ok:true,json:()=>new Promise(()=>{})})
  const body=request('/body'), bodyRejected=assert.rejects(body,/超时/)
  await tick(); [...timers.values()][0].fn(); await bodyRejected
  assert.equal(timers.size,0)
  calls.length=0
  responder=async()=>new Promise(()=>{})
  const controller=new AbortController()
  const cancelled=request('/cancel',{signal:controller.signal}), cancelledRejected=assert.rejects(cancelled,/取消/)
  await tick();controller.abort();await cancelledRejected
  assert.equal(calls[0].signal.aborted,true);assert.equal(timers.size,0)
  calls.length=0;let attempts=0
  responder=async url=>({ok:true,json:async()=>url.startsWith('/speedtest')?{sid:'renewed'}:(++attempts===1?{errorCode:1,message:'fail/sid:expired'}:{data:[1],sid:'renewed'})})
  const recovered=await request('/retry')
  assert.deepEqual(Array.from(recovered.data),[1]);assert.equal(calls.length,3);assert.equal(attempts,2);assert.equal(timers.size,0)
  calls.length=0
  responder=async url=>({ok:true,json:async()=>url.startsWith('/speedtest')?{sid:'renewed'}:{errorCode:1,message:'fail/sid:still-invalid'}})
  await assert.rejects(request('/retry-once'),/fail\/sid/)
  assert.equal(calls.length,3,'one SID refresh and one retry only')
  calls.length=0
  vmctx[variant==='source'?'apiSid':'Z0']=null
  responder=async()=>new Promise(()=>{})
  const sid=request('/sid-stall'),sidRejected=assert.rejects(sid,/超时/)
  await tick();assert.ok(calls[0].url.startsWith('/speedtest'));[...timers.values()][0].fn();await sidRejected
  assert.ok(calls[0].signal.aborted);assert.equal(timers.size,0)
  console.log('PASS '+variant+': API fifteen-second total deadline covers SID/fetch/body; cancellation; one retry; no leftover timers')

  vmctx.cache=new Map();vmctx.Wt=new Map();vmctx.mediaUrl=p=>p;vmctx.Fr=p=>p;vmctx.isEncryptedMedia=()=>true;vmctx.hi=()=>true
  vmctx.decryptToDataUrl=()=>'';vmctx.S6=()=>'';vmctx.Uint8Array=Uint8Array
  vm.runInContext(variant==='source'?sourceFunction('src/api/media.js','decryptMedia'):topFunction('jn'),vmctx)
  responder=async()=>({ok:true,arrayBuffer:()=>new Promise(()=>{})})
  const media=vmctx[variant==='source'?'decryptMedia':'jn']('/slow.ceb'),mediaRejected=assert.rejects(media,/超时/)
  await tick();assert.equal([...timers.values()][0].delay,5000);[...timers.values()][0].fn();await mediaRejected
  assert.equal(timers.size,0)
  assert.equal((variant==='source'?vmctx.cache:vmctx.Wt).size,0,'failed cache entry evicted')
  console.log('PASS '+variant+': encrypted cover body has five-second deadline and failed cache entry is evicted')
}

const shorts = componentFunctions('DouyinPage')
for (const variant of ['source', 'shipped']) {
  const fallback = { douyin: { items: [{ user: 'fixture', tags: [], shares: 0 }] } }
  const ctx = vm.createContext({ tabsFallback: fallback, Ge: fallback })
  vm.runInContext(variant === 'source' ? sourceFunction('src/views/DouyinPage.vue', 'hydrateShortList') : shorts('C'), ctx)
  const items = ctx[variant === 'source' ? 'hydrateShortList' : 'C']([{ id: 'A', cover: '/good.png' }, { id: 'B', cover: '/hung.ceb' }])
  assert.ok(Array.isArray(items), 'list hydration never awaits media')
  assert.equal(items.length, 2)
  assert.equal(items[0].coverSrc, '')
  console.log('PASS ' + variant + ': list renders synchronously before independent cover requests')
}
for (const variant of ['source','shipped']) {
  const videos=[0,1].map(()=>({src:'',isConnected:true,readyState:0,plays:0,listeners:new Map(),
    pause(){},removeAttribute(){this.src=''},load(){this.readyState=0},play(){this.plays++;return Promise.resolve()},
    addEventListener(n,f){this.listeners.set(n,f)},removeEventListener(n,f){if(this.listeners.get(n)===f)this.listeners.delete(n)}}))
  const list={value:[{id:'A',videoUrl:'A.mp4'},{id:'B',videoUrl:'B.mp4'}]}, owned=new Map()
  const feed={value:{querySelector:selector=>({querySelector:()=>videos[Number(selector.match(/"(\d+)"/)[1])]})}}
  const vmctx=vm.createContext({items:list,i:list,players:owned,o:owned,feedEl:feed,p:feed,playSeq:0,auditPlaySeq:0,loadSeq:1,g:1,activeIdx:-1,l:-1,
    createPlaybackSession,auditPlayback:createPlaybackSession,proxyMediaUrl:p=>p,So:p=>p})
  const functions=variant==='source'?['candidatesFor','destroyPlayer','destroyAllPlayers','videoElAt','playIdx'].map(n=>sourceFunction('src/views/DouyinPage.vue',n)):['f','m','x','w','u'].map(shorts)
  vm.runInContext(functions.join('\n'),vmctx)
  const play=vmctx[variant==='source'?'playIdx':'u']
  const a=play(0);await tick();const lateA=videos[0].listeners.get('loadeddata')
  const b=play(1);await tick()
  videos[1].readyState=2;videos[1].listeners.get('loadeddata')()
  await b;videos[0].readyState=2;lateA();await a
  assert.equal(videos[0].plays,0);assert.equal(videos[1].plays,1);assert.equal(owned.size,1)
  vmctx[variant==='source'?'destroyAllPlayers':'x']()
  assert.equal(owned.size,0);assert.equal(videos[1].listeners.size,0)
  console.log('PASS '+variant+': actual short-page A→B callback never restarts A; current B owns playback; teardown')
}
