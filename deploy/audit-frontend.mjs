// Bounded transformations of the actual production program, not a rebuild of
// historical source. AST ranges and exact match counts make unknown input fail.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { parse } from '@babel/parser'
import { patchBundle } from './deploy-ad-sync.mjs'
import { patchStageTwo } from './audit-frontend-stage2.mjs'

export const digest = data => crypto.createHash('sha256').update(data).digest('hex')
export function exact(code, before, after) {
  assert.equal(code.split(before).length, 2, 'Expected exactly one patch target: ' + before.slice(0, 100))
  return code.replace(before, after)
}
export function functionBody(code, name, body, prepend = false) {
  const nodes = parse(code, { sourceType: 'module' }).program.body.filter(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  assert.equal(nodes.length, 1, 'Expected function ' + name)
  const n = nodes[0].body
  return code.slice(0, n.start + 1) + body + (prepend ? code.slice(n.start + 1, n.end - 1) : '') + code.slice(n.end - 1)
}
export function patchAuditFrontend(input, stage = 1) {
  let code = patchBundle(input)
  assert.equal(digest(code), 'ce82a760c7a123aa8e911ce8ac128304b4aa821de594adea894553308260932c')
  code = functionBody(code, 'G8', 'throw new Error("新支付暂时关闭，已有订单仍可查询");')
  code = functionBody(code, 'ha', 'return {unavailable:true};')
  code = functionBody(code, 'j3', 'throw new Error("本地客户签到尚未接入，未领取任何奖励");')
  code = functionBody(code, 'z3', 'return {commentCount:"—",downloadCount:"—",aiCreateCount:"—"};')
  code = functionBody(code, 'u3', 'if(!e||e.unavailable)return{id:"",name:"访客",bio:"客户账户尚未接入，身份卡与邀请功能正常使用"};', true)
  code = functionBody(code, 'T3', 'if(!e||e.unavailable)return{follow:"—",like:"—",fav:"—"};', true)
  code = functionBody(code, 'et', 'if(!e||e.unavailable)return{uid:"",gold:"—",diamond:"—",points:"—",isVip:false,vipName:"本地账户未接入",vipUntil:"",watchTickets:"—",downloadTickets:"—",inviteCode:"",inviteCount:0,downloadUrl:"",customerUrl:""};', true)
  for (const [before, after] of [
    ['i=pe({...Ge.mine.user}),p=pe({...Ge.mine.stats})', 'i=pe(u3(null)),p=pe(T3(null))'],
    ['class:"recharge__submit",disabled:f.value||!d.value.length||!u.value,onClick:N},z(f.value?"拉起支付中…":"立即支付")', 'class:"recharge__submit",disabled:true},"新支付已暂停"'],
    ['支付由第三方通道处理，请扫码完成付款。', '新支付暂时关闭，已有订单仍可查询；查询结果不代表本地权益到账。'],
    ['支付成功，正在返回…', '渠道返回已支付，本地权益未入账'],
    ['开通会员解锁全站权益', '账户权益尚未接入，充值已暂停'],
    ['送 1 日 VIP', '账户权益尚未接入'],
    ['class:"signin",disabled:i.value,onClick:d},z(i.value?"签到中…":"每日签到")', 'class:"signin",disabled:true},"本地签到奖励尚未接入"'],
  ]) code = exact(code, before, after)
  assert.ok(!code.includes('o0("/users/info")') && !code.includes('o0("/users/signin"'))
  assert.ok(!code.includes('fetch(Ko("/create")'))
  if (stage >= 2) code = patchStageTwo(code, { exact, functionBody })
  assert.ok(stage >= 1 && stage <= 2, 'Unimplemented release stage')
  parse(code, { sourceType: 'module' })
  return code
}
