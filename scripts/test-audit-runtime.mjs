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

assert.ok(manifest.stage >= 5, 'current regression requires the stage-five runtime')
const popupFunctions = componentFunctions('AdPopup')
const featuredFunctions = componentFunctions('FeaturedPage')
for (const variant of ['source','shipped']) {
  const ctx=vm.createContext({ mediaUrl:v=>v, ia:v=>v, formatDuration:v=>v, Wo:v=>v })
  const program=variant==='source'
    ? ['formatCount','parseViewCount','normalizeVideo'].map(n=>sourceFunction('src/api/normalize.js',n)).concat(sourceFunction('src/views/FeaturedPage.vue','sortFeaturedList'))
    : [topFunction('u0'),topFunction('auditViewCount'),topFunction('Xp'),featuredFunctions('x')]
  vm.runInContext(program.join('\n'),ctx)
  const normalize=ctx[variant==='source'?'normalizeVideo':'Xp'],sort=ctx[variant==='source'?'sortFeaturedList':'x']
  const normalized=[{id:'nine',name:'9000 fixture',playCnt:9000},{id:'twenty',name:'20000 fixture',playCnt:20000},{id:'higher',name:'20444 fixture',playCnt:20444}].map(normalize)
  assert.deepEqual(Array.from(sort(normalized,'最热'),v=>v.id),['higher','twenty','nine'])
  const fallback=[{id:'a',views:'9000'},{id:'b',views:'2万'},{id:'c',views:'2w'},{id:'zero',viewsRaw:0,views:'9w'}]
  assert.deepEqual(Array.from(sort(fallback,'最热'),v=>v.id),['b','c','a','zero'])
  console.log('PASS '+variant+': hottest uses unrounded raw count; w/万 fallback; zero priority; stable ties')
}
for (const variant of ['source','shipped']) {
  const refs={ ads:{value:[{name:'bad',image:'/bad.ceb',url:'https://example.invalid/A'},{name:'good',image:'/good.png',url:'https://example.invalid/B'}]}, grid:{value:[]}, index:{value:0}, mode:{value:'image'}, visible:{value:false}, src:{value:''}, href:{value:''}, current:{value:null}, length:{value:2} }
  const events=[],storage=new Map(),timers=new Map();let timerId=0
  const ctx=vm.createContext({afterAds:refs.ads,d:refs.ads,gridAds:refs.grid,o:refs.grid,index:refs.index,r:refs.index,mode:refs.mode,l:refs.mode,visible:refs.visible,f:refs.visible,currentSrc:refs.src,C:refs.src,currentHref:refs.href,s:refs.href,currentAd:refs.current,auditCurrentAd:refs.current,queueLen:refs.length,h:refs.length,
    sessionIndex:0,a:0,showGen:0,n:0,sessionQueueDone:false,t:false,nextTimer:null,auditNextTimer:null,DONE_KEY:'done',oc:'done',
    sessionStorage:{setItem:(k,v)=>storage.set(k,v)},setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),
    decryptMedia:async src=>{if(src==='/bad.ceb')throw new Error('404');return src},jn:async src=>{if(src==='/bad.ceb')throw new Error('404');return src},resolveAdTarget:ad=>ad.url,It:ad=>ad.url,
    trackAdInteraction:(ad,slot)=>events.push({ad,slot}),auditTrack:(ad,slot)=>events.push({ad,slot}),URL,location:{href:'https://fixture.invalid/'}})
  const names=variant==='source'?['showAt','markDone','close','onAdClick','onImageError','refreshPopupConfig']:['m','x','w','T','auditImageError','auditRefreshPopupConfig']
  const program=variant==='source'?names.map(n=>sourceFunction('src/components/AdPopup.vue',n)):names.map(popupFunctions)
  vm.runInContext(program.join('\n'),ctx)
  await ctx[names[0]](0);await tick()
  assert.equal(refs.index.value,1);assert.equal(refs.visible.value,true);assert.equal(refs.href.value,'https://example.invalid/B')
  ctx[names[3]]({preventDefault(){throw new Error('unexpected prevention')}})
  assert.equal(events.length,1);assert.equal(events[0].ad.name,'good');assert.equal(events[0].slot,'afterEnterApp')
  ctx[names[2]]();await tick()
  assert.equal(refs.visible.value,false);assert.equal(storage.get('done'),'1');assert.equal(timers.size,0)
  await ctx[names[0]](1);await tick()
  ctx[names[4]]({target:{currentSrc:'https://fixture.invalid/good.png'}});await tick()
  assert.equal(refs.visible.value,false,'ordinary broken image also advances to queue end')
  ctx.sessionQueueDone=false;ctx.t=false
  refs.ads.value=[{name:'live popup',image:'/live.png',url:'https://example.invalid/live'}]
  refs.length.value=1
  await ctx[names[0]](0);await tick()
  assert.equal(refs.visible.value,true)
  refs.ads.value=[];refs.length.value=0
  ctx[names[5]]();await tick()
  assert.equal(refs.visible.value,false,'deleting the displayed popup hides it without reloading')
  refs.ads.value=[{name:'later popup',image:'/later.png',url:'https://example.invalid/later'}];refs.length.value=1
  ctx[names[5]]();await tick()
  assert.equal(refs.visible.value,false,'a completed queue does not reopen on configuration polling')
  console.log('PASS '+variant+': bad image skipped; correct index/link/click; no repeated B; ordinary image error; queue invalidation')
}
for (const variant of ['source','shipped']) {
  const state={ready:false,customerId:'',cardNo:'',inviteCode:'',inviteCount:0,error:''},storage=new Map([['dw_device_fp','stable-fixture-fp']])
  const calls=[];let responder=async()=>({customerId:'DW-QA',cardNo:'CARD-QA',inviteCode:'1234567890123',inviteCount:0,token:'fixture-token'})
  const request=async(url,options)=>{calls.push({url,options});return responder(url,options)}
  const ctx=vm.createContext({customerState:state,He:state,claimInFlight:null,refreshInFlight:null,fetchJsonTimed:request,auditJSON:request,readonly:v=>v,Zt:v=>v,deviceFp:()=>storage.get('dw_device_fp'),Zf:()=>storage.get('dw_device_fp'),inviteCodeFromLocation:()=>'',Uf:()=>'',TOKEN_KEY:'dw_card_token',Cc:'dw_card_token',
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}})
  const names=variant==='source'?['applyCustomerResult','claimCustomer','refreshCustomer']:['auditApplyCustomer','Io','auditRefreshCustomer']
  vm.runInContext((variant==='source'?names.map(n=>sourceFunction('src/composables/useCustomer.js',n)):names.map(topFunction)).join('\n'),ctx)
  const pending=deferred();responder=()=>pending.promise
  const first=ctx[names[1]](),second=ctx[names[1]]()
  assert.equal(calls.length,1,'claim shares in-flight identity recovery')
  pending.resolve({customerId:'DW-QA',cardNo:'CARD-QA',inviteCode:'1234567890123',inviteCount:0,token:'fixture-token'})
  await Promise.all([first,second])
  calls.length=0
  responder=async()=>({customerId:'DW-QA',cardNo:'CARD-QA',inviteCode:'1234567890123',inviteCount:7})
  await Promise.all([ctx[names[2]](),ctx[names[2]]()])
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/public/customers/me');assert.equal(calls[0].options.credentials,'include')
  assert.equal(state.inviteCount,7);assert.equal(state.customerId,'DW-QA');assert.equal(state.cardNo,'CARD-QA')
  calls.length=0
  responder=async()=>{throw Object.assign(new Error('unavailable'),{status:503})}
  await assert.rejects(ctx[names[2]](),/unavailable/);assert.equal(calls.length,1);assert.equal(state.inviteCount,7)
  calls.length=0
  responder=async url=>{if(url.endsWith('/me'))throw Object.assign(new Error('expired'),{status:404});return {customerId:'DW-QA',cardNo:'CARD-QA',inviteCode:'1234567890123',inviteCount:8}}
  await Promise.all([ctx[names[2]](),ctx[names[2]]()])
  assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].options.body).deviceFp,'stable-fixture-fp');assert.equal(state.inviteCount,8)
  const before=JSON.stringify(state)
  responder=async()=>({customerId:'OTHER',cardNo:'OTHER',inviteCode:'other',inviteCount:99})
  await assert.rejects(ctx[names[2]](),/身份不一致/)
  assert.equal(JSON.stringify(state),before)
  console.log('PASS '+variant+': real customer GET refresh; identity preserved; concurrent recovery single-flight; 503 no claim; mismatch rejected')
}

assert.ok(manifest.stage >= 6, 'automatic configuration sync requires the stage-six artifact')
for (const variant of ['source', 'shipped']) {
  const state={ready:false,error:'',version:0,config:{apps:[]},popups:{},tabs:{}}
  const timers=new Map(),calls=[];let timerId=0
  const emitter=()=>({listeners:new Map(),addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn)},removeEventListener(name,fn){this.listeners.get(name)?.delete(fn)},emit(name){for(const fn of this.listeners.get(name)||[])fn()}})
  const win=emitter(),doc={...emitter(),hidden:false}
  const makeBundle=version=>({config:{apps:[{name:'live-'+version}]},popups:{afterEnterApp:[]},tabs:{mine:{quickApps:[]},featured:{ad:{}}},apiSession:{},meta:{version}})
  let published=makeBundle(1),responder
  const request=async(url,options)=>{calls.push(url.split('?')[0]);assert.equal(options.cache,'no-store');return responder(url)}
  const serve=url=>Promise.resolve(url.includes('/meta.json')?{version:published.meta.version}:structuredClone(published))
  responder=serve
  const ctx=vm.createContext({siteConfig:state,rt:state,siteConfigFlight:null,auditSiteFlight:null,siteConfigLoaded:false,auditSiteLoaded:false,siteSyncCleanup:null,auditSiteCleanup:null,
    fetchJsonTimed:request,auditJSON:request,applyApiSession(){},sy(){},readonly:v=>v,Zt:v=>v,window:win,document:doc,
    setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},clearInterval:id=>timers.delete(id)})
  const names=variant==='source'?['emptySiteConfig','applySiteConfig','loadSiteConfig','startSiteConfigSync']:['auditEmpty','auditApplySite','yy','auditSiteStart']
  vm.runInContext((variant==='source'?names.map(n=>sourceFunction('src/composables/useSiteConfig.js',n)):names.map(topFunction)).join('\n'),ctx)
  const initial=deferred();responder=()=>initial.promise
  const first=ctx[names[2]](),second=ctx[names[2]]()
  assert.equal(first,second,'bootstrap requests share one in-flight promise')
  assert.equal(calls.length,1);assert.equal(state.ready,false)
  initial.resolve(published);await first
  assert.equal(state.ready,true);assert.equal(state.version,1)
  const current=state.config,waiting=deferred();responder=()=>waiting.promise
  const refresh=ctx[names[2]]({checkVersion:true})
  assert.equal(state.ready,true,'background sync never unmounts the current page')
  assert.equal(state.config,current)
  assert.equal(ctx[names[2]]({checkVersion:true}),refresh)
  published=makeBundle(2);responder=serve;waiting.resolve({version:2});await refresh
  assert.equal(state.version,2);assert.equal(state.config.apps[0].name,'live-2')
  const stable=state.config;calls.length=0
  await ctx[names[2]]({checkVersion:true})
  assert.equal(state.config,stable,'same version does not reset reactive components')
  assert.deepEqual(calls,['/data/meta.json'],'unchanged polling transfers only small metadata')
  responder=async()=>{throw new Error('503')}
  await ctx[names[2]]({checkVersion:true})
  assert.equal(state.ready,true);assert.equal(state.config,stable);assert.match(state.error,/自动重试/)
  published=makeBundle(3);responder=url=>Promise.resolve(url.includes('/meta.json')?{version:3}:{...published,config:{apps:{}}})
  await ctx[names[2]]({checkVersion:true});assert.equal(state.version,2);assert.equal(state.config,stable)
  responder=serve;await ctx[names[2]]({checkVersion:true})
  assert.equal(state.version,3);assert.equal(state.error,'')
  assert.equal(ctx[names[1]](makeBundle(2)),false,'a stale snapshot cannot roll back a newer version')
  assert.equal(state.version,3)
  const cleanup=ctx[names[3]]();await tick()
  assert.equal(ctx[names[3]](),cleanup);assert.equal(timers.size,1)
  assert.equal([...timers.values()][0].ms,5000)
  published=makeBundle(4);[...timers.values()][0].fn();await tick()
  assert.equal(state.version,4,'a live page receives a new config on the actual poll callback')
  doc.hidden=true;doc.emit('visibilitychange');assert.equal(timers.size,0)
  const hiddenCalls=calls.length;win.emit('focus');await tick();assert.equal(calls.length,hiddenCalls)
  doc.hidden=false;published=makeBundle(5);doc.emit('visibilitychange');await tick()
  assert.equal(state.version,5);assert.equal(timers.size,1)
  win.emit('pagehide');assert.equal(timers.size,0)
  win.emit('pageshow');await tick();assert.equal(timers.size,1)
  published=makeBundle(6);const focusCalls=calls.length;win.emit('focus');win.emit('online');await tick()
  assert.equal(state.version,6);assert.equal(calls.length-focusCalls,2,'focus and online share metadata+snapshot requests')
  cleanup();assert.equal(timers.size,0)
  assert.equal([...win.listeners.values(),...doc.listeners.values()].reduce((n,set)=>n+set.size,0),0)
  ctx.siteConfigLoaded=false;ctx.auditSiteLoaded=false;state.ready=false;state.version=0
  responder=async()=>{throw new Error('initial load unavailable')}
  await ctx[names[2]]()
  assert.equal(state.ready,true);assert.match(state.error,/配置加载失败/)
  const initialRetry=deferred();responder=()=>initialRetry.promise
  const retrying=ctx[names[2]]()
  assert.equal(state.ready,true,'automatic first-load retry keeps the error and retry button mounted')
  initialRetry.resolve(makeBundle(1));await retrying
  assert.equal(state.version,1);assert.equal(state.error,'')
  console.log('PASS '+variant+': single-flight live config; same-version metadata only; background page retained; failure recovery; stale rejection; 5s poll; focus/online/visibility/BFCache; cleanup')
}
