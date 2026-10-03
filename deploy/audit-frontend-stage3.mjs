import assert from 'node:assert/strict'
import { parse } from '@babel/parser'
import { sourceFunction } from './audit-frontend-stage2.mjs'
export function componentFunction(code, component, name, replacement) {
  let setup
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ObjectExpression' && node.properties.some(p => p.key?.name === '__name' && p.value?.value === component)) {
      setup = node.properties.find(p => p.key?.name === 'setup').body
      return
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value)
  }
  walk(parse(code, { sourceType: 'module' }))
  assert.ok(setup, component)
  const nodes = setup.body.filter(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  assert.equal(nodes.length, 1, component + ':' + name)
  return code.slice(0, nodes[0].start) + replacement + code.slice(nodes[0].end)
}
export function patchStageThree(code, { exact, functionBody }) {
  code += '\n' + sourceFunction('src/lib/playbackSession.js', 'createPlaybackSession', { createPlaybackSession: 'auditPlayback' })
  code += '\n' + sourceFunction('src/api/ad.js', 'trackAdInteraction', { trackAdInteraction: 'auditTrack', trackAdSign: 'Sn', trackAdClick: 'mf' })
  code = functionBody(code, 'Rp', 'const target=It(e);if(!/^https?:/i.test(target))return false;auditTrack(e,t);window.open(target,"_blank","noopener,noreferrer");return true;')
  code = exact(code, 'Sn((u=d.value[r.value])==null?void 0:u.signUrl)', 'auditTrack(d.value[r.value],"afterEnterApp")')
  code = exact(code, 'onClick:g=>se(Sn)(U.signUrl)', 'onClick:g=>auditTrack(U,"gridPopAds")')
  code = exact(code, 'Sn(t.signUrl)}return(p,c)', 'auditTrack(t,"promo")}return(p,c)')
  code = exact(code, 'Rp({url:t.url,signUrl:t.signUrl})', 'Rp({name:t.title,url:t.url,signUrl:t.signUrl},"floatBanner")')
  code = exact(code, 'if(Rp(T))return', 'if(Rp(T,"appCenter"))return')
  code = exact(code, 'function T(b){Rp(b)}', 'function T(b,slot="mineQuickApps"){Rp(b,slot)}')
  code = exact(code, 'key:"r-"+S.name+Y,class:"quick-app",onClick:I=>T(S)', 'key:"r-"+S.name+Y,class:"quick-app",onClick:I=>T(S,"mineRecommendations")')
  code = exact(code, 'let o=null,r=0;function l(){window.history', 'let r=0;const auditPlayer=auditPlayback({getVideo:()=>n.value,getSequence:()=>r,loadHls:()=>import("./hls-DTZVvFfy.js"),proxy:So});function l(){window.history')
  // Rename the source-local "d" before binding the runtime's status ref "d".
  const bindings = { d: 'videoDetail', loadRelated: 's', load: 'T', destroyPlayer: 'm', route: 't', router: 'a', videoEl: 'n', detail: 'i', related: 'p', poster: 'c', status: 'd', loadSeq: 'r', playback: 'auditPlayer', excludeCurrent: 'C', RELATED_LIMIT: 'bt', fetchRecommend: 'Wp', normalizeFeaturedPayload: 'R0', fetchVideoDetail: 'y3', normalizeVideoDetail: 'f3', decryptMedia: 'jn' }
  for (const [name, target] of [['loadRelated', 's'], ['destroyPlayer', 'm'], ['load', 'T']]) {
    const replacement = sourceFunction('src/views/PlayPage.vue', name, bindings).replace("import('../data/video-pool.json')", 'import("./video-pool-Cmx7NngR.js")')
    code = componentFunction(code, 'PlayPage', target, replacement)
  }
  for (const name of ['x', 'w']) code = componentFunction(code, 'PlayPage', name, '')
  code = exact(code, 'y0(()=>t.params.id,T),En(m)', 'y0(()=>t.params.id,T),En(()=>{++r;m()})')
  code = exact(code, 'poster:c.value||void 0,onError:h', 'poster:c.value||void 0')
  code = functionBody(code, 'qn', 'if(window.DewuBridge?.copyText){try{await window.DewuBridge.copyText(String(e));return true}catch{return false}}', true)
  code = exact(code, "1. 复制链接或邀请码分享给好友，好友下载并注册后即算邀请成功。", "1. 分享本地邀请码或专属链接，邀请关系由身份卡服务记录。")
  code = exact(code, "2. 邀请成功后，双方均可获得会员时长奖励。", "2. 本地奖励尚未接入，不代表会员时长或积分已经到账。")
  code = exact(code, "3. 好友需完成账号绑定，奖励才会到账。", "3. 当前仅展示邀请码、邀请链接和已记录的邀请人数。")
  code = exact(code, 'y.click(),Ae("已保存，手机可长按相册")', 'window.DewuBridge?.saveImage?(await window.DewuBridge.saveImage(y.href,y.download).then(result=>Ae(result?.status==="cancelled"?"已取消保存":"身份卡已保存")).catch(()=>Ae("保存失败，请重试"))):(y.click(),Ae("已发起下载，请查看系统下载记录"))')
  return code
}
