import assert from 'node:assert/strict'
import { sourceFunction } from './audit-frontend-stage2.mjs'
import { componentFunction } from './audit-frontend-stage3.mjs'
import { replaceFunction } from './audit-frontend-stage4.mjs'

export function patchStageFive(code, { exact }) {
  // Declarations are hoisted: the archived bundle invokes bootstrap before appended helpers.
  code += '\nvar claimInFlight,refreshInFlight;'
  const customer = { customerState:'He',applyCustomerResult:'auditApplyCustomer',refreshCustomer:'auditRefreshCustomer',fetchJsonTimed:'auditJSON',claimCustomer:'Io',readonly:'Zt' }
  for (const name of ['applyCustomerResult','refreshCustomer']) code += '\n' + sourceFunction('src/composables/useCustomer.js',name,customer)
  code += '\n' + sourceFunction('src/views/SharePage.vue','loadShare',{loadShare:'auditLoadShare',refreshCustomer:'auditRefreshCustomer',showToast:'Ae'})
  code = exact(code,'c0(async()=>{try{const c=await ha();t.value=et(c.data??c)}catch{!a.inviteCode&&!a.customerId&&Ae("获取邀请信息失败")}})', 'c0(auditLoadShare)')
  code = componentFunction(code,'MinePage','B',sourceFunction('src/views/MinePage.vue','refresh',{refresh:'B',refreshCustomer:'auditRefreshCustomer',showToast:'Ae'}))
  code = componentFunction(code,'MinePage','g',sourceFunction('src/views/MinePage.vue','onBind',{onBind:'g',showToast:'Ae'}))
  code += '\n' + sourceFunction('src/api/normalize.js','parseViewCount',{parseViewCount:'auditViewCount'})
  code = replaceFunction(code,'Xp',sourceFunction('src/api/normalize.js','normalizeVideo',{normalizeVideo:'Xp',mediaUrl:'ia',formatCount:'u0',formatDuration:'Wo'}))
  code = componentFunction(code,'FeaturedPage','x',sourceFunction('src/views/FeaturedPage.vue','sortFeaturedList',{sortFeaturedList:'x',parseViewCount:'auditViewCount'}))
  code = exact(code,'U=++w;f.value=s(y,u);','U=++w;f.value=x(s(y,u),u);')
  const popup = {sessionQueueDone:'t',sessionIndex:'a',showGen:'n',index:'r',mode:'l',visible:'f',currentSrc:'C',currentHref:'s',currentAd:'auditCurrentAd',queueLen:'h',afterAds:'d',gridAds:'o',markDone:'x',showAt:'m',nextTimer:'auditNextTimer',DONE_KEY:'oc',decryptMedia:'jn',resolveAdTarget:'It',trackAdInteraction:'auditTrack',close:'w',onAdClick:'T',onImageError:'auditImageError'}
  for(const [name,target] of [['showAt','m'],['markDone','x'],['close','w'],['onAdClick','T']]) code = componentFunction(code,'AdPopup',target,sourceFunction('src/components/AdPopup.vue',name,popup))
  code = exact(code,'let t=!1,a=0,n=0;', 'let t=false,a=0,n=0,auditNextTimer=null;const auditCurrentAd=pe(null);'+sourceFunction('src/components/AdPopup.vue','onImageError',popup))
  code = exact(code,'return c0(()=>{try{if(sessionStorage.getItem(oc)', 'return En(()=>{++n;clearTimeout(auditNextTimer)}),c0(()=>{try{if(sessionStorage.getItem(oc)')
  code = exact(code,'class:"popup-img"}','class:"popup-img",onError:auditImageError}')
  const copy = [
  [
    "注册 / 绑定有礼",
    "注册 / 绑定尚未接入"
  ],
  [
    "限时特惠权限等你开启",
    "会员权益尚未接入"
  ],
  [
    "立即开通",
    "查看状态"
  ],
  [
    "充值越高赠送越多",
    "充值已暂停，当前不发放奖励"
  ],
  [
    "立即充值",
    "查看订单说明"
  ],
  [
    "完成签到可恢复断签并领取奖励",
    "签到尚未接入，当前不发放奖励"
  ],
  [
    "好友得好礼",
    "仅记录邀请关系"
  ],
  [
    "每日观看影片可得积分",
    "观看奖励尚未接入，当前不发放奖励"
  ],
  [
    "参与评论互动可得积分",
    "评论奖励尚未接入，当前不发放奖励"
  ],
  [
    "在应用中心下载推荐应用",
    "下载奖励尚未接入，当前不发放奖励"
  ],
  [
    "邀请好友注册双方得奖励",
    "仅记录邀请关系，当前不发放奖励"
  ],
  [
    "充值钻石享额外赠送",
    "充值已暂停，当前不发放奖励"
  ]
]
  for (const [before,after] of copy) {
    if (before === '完成签到可恢复断签并领取奖励') {
      assert.equal(code.split(before).length, 3, 'template and fallback task label')
      code = code.replaceAll(before, after)
    } else code = exact(code,before,after)
  }
  code = exact(code,'class:"task__go",onClick:f=>se(t).push(l.to)},"去完成"', 'class:"task__go",onClick:()=>Ae("奖励尚未接入，当前不发放奖励")},"查看说明"')
  return code
}
