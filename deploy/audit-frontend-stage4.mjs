import assert from 'node:assert/strict'
import { parse } from '@babel/parser'
import { sourceFunction } from './audit-frontend-stage2.mjs'
import { componentFunction } from './audit-frontend-stage3.mjs'

export function replaceFunction(code, name, replacement) {
  const nodes = parse(code, { sourceType: 'module' }).program.body.filter(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  assert.equal(nodes.length, 1, name)
  return code.slice(0, nodes[0].start) + replacement + code.slice(nodes[0].end)
}
export function patchStageFour(code, { exact }) {
  code += '\n' + sourceFunction('src/api/timedFetch.js', 'withRequestDeadline', { withRequestDeadline: 'auditDeadline' })
  code += '\nlet auditLastFetchAt=null;'
  const api = { apiFetch:'o0',refreshApiSid:'Zn',activeBase:'na',pickApiBase:'Yo',apiSid:'Z0',requestPath:'Zo',PID:'Bo',authHeaders:'Fo',isSidError:'ff',unwrapApiPayload:'yf',lastFetchAt:'auditLastFetchAt',withRequestDeadline:'auditDeadline',fetchJsonTimed:'auditJSON' }
  for (const [name, target] of [['apiFetch','o0'],['refreshApiSid','Zn']]) code = replaceFunction(code,target,sourceFunction('src/api/client.js',name,api))
  code = replaceFunction(code,'jn',sourceFunction('src/api/media.js','decryptMedia',{decryptMedia:'jn',mediaUrl:'Fr',isEncryptedMedia:'hi',cache:'Wt',decryptToDataUrl:'S6',withRequestDeadline:'auditDeadline'}))
  for (const [name,target] of [['fetchRecommend','Wp'],['fetchVideoDetail','y3'],['fetchShortByCategorie','C3'],['fetchShortAndImg','s3']]) code=replaceFunction(code,target,sourceFunction('src/api/videos.js',name,{[name]:target,apiFetch:'o0'}))
  code = exact(code,'let r=0;const auditPlayer=', 'let r=0,loadController=null;const auditPlayer=')
  code = exact(code,'loadHls:()=>import("./hls-DTZVvFfy.js"),proxy:So});function l()', 'loadHls:()=>import("./hls-DTZVvFfy.js"),proxy:So,onError:()=>{d.value="视频加载失败，请稍后重试"}});function l()')
  code = exact(code,'En(()=>{++r;m()})','En(()=>{++r;loadController?.abort();m()})')
  const bindings = { hydrateShortList:'C',hydratePosters:'auditHydratePosters',tabsFallback:'Ge',items:'i',decryptMedia:'jn',loadSeq:'g',players:'o',playSeq:'auditPlaySeq',activeIdx:'l',destroyPlayer:'m',destroyAllPlayers:'x',videoElAt:'w',feedEl:'p',playIdx:'u',candidatesFor:'f',createPlaybackSession:'auditPlayback',proxyMediaUrl:'So',loadShorts:'k',loadController:'auditShortLoadController',activeTab:'a',shortCategories:'Z3',fetchShortByCategorie:'C3',fetchShortAndImg:'s3',normalizeShortPayload:'zi',tabFallbackItems:'h',nextTick:'Bp',setupObserver:'_' }
  for(const [name,target] of [['hydrateShortList','C'],['destroyPlayer','m'],['destroyAllPlayers','x'],['videoElAt','w'],['playIdx','u'],['loadShorts','k']]) {
    // hydrateShortList uses the data property `items`, not the component ref.
    const localBindings = { ...bindings }
    if (name === 'hydrateShortList') delete localBindings.items
    code = componentFunction(code,'DouyinPage',target,sourceFunction('src/views/DouyinPage.vue',name,localBindings).replace("import('hls.js')",'import("./hls-DTZVvFfy.js")'))
  }
  for (const obsolete of ['T','y','U']) code=componentFunction(code,'DouyinPage',obsolete,'')
  code = exact(code,'let r=null,l=-1;function f(', 'let r=null,l=-1,auditPlaySeq=0,auditShortLoadController=null;'+sourceFunction('src/views/DouyinPage.vue','hydratePosters',bindings)+';function f(')
  code = exact(code,'En(()=>{r==null||r.disconnect(),x()})', 'En(()=>{++g;auditShortLoadController?.abort();r?.disconnect();x()})')
  code = exact(code,',onError:N=>U(v)', '')
  return code
}
