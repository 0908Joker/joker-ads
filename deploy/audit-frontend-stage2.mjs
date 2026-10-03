import fs from 'node:fs'
import assert from 'node:assert/strict'
import { parse } from '@babel/parser'
export function sourceFunction(file, name, bindings = {}, bodyOnly = false) {
  const raw = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const source = file.endsWith('.vue') ? raw.split('<script setup>')[1].split('</script>')[0] : raw
  const functions = parse(source, { sourceType: 'module' }).program.body.map(n => n.declaration || n)
  const node = functions.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  assert.ok(node, file + ' ' + name)
  let text = bodyOnly ? source.slice(node.body.start + 1, node.body.end - 1) : source.slice(node.start, node.end)
  for (const [from, to] of Object.entries(bindings)) text = text.replace(new RegExp('\\b' + from + '\\b', 'g'), to)
  return text
}
export function patchStageTwo(code, { exact, functionBody }) {
  code += '\n' + sourceFunction('src/api/timedFetch.js', 'fetchJsonTimed', { fetchJsonTimed: 'auditJSON', withRequestDeadline: 'auditDeadline' })
  code += '\n' + sourceFunction('src/composables/useSiteConfig.js', 'emptySiteConfig', { emptySiteConfig: 'auditEmpty' })
  code = exact(code, 'const rt=Ct({ready:!1,config:{...NC},popups:{...yo},tabs:{...Ge},version:1})', 'const rt=Ct({ready:!1,error:"",...auditEmpty(),version:0})')
  code = functionBody(code, 'yy', sourceFunction('src/composables/useSiteConfig.js', 'loadSiteConfig', { siteConfig: 'rt', emptySiteConfig: 'auditEmpty', fetchJsonTimed: 'auditJSON', applyApiSession: 'sy', readonly: 'Zt' }, true))
  code = functionBody(code, 'Io', sourceFunction('src/composables/useCustomer.js', 'claimCustomer', { deviceFp: 'Zf', inviteCodeFromLocation: 'Uf', TOKEN_KEY: 'Cc', customerState: 'He', readonly: 'Zt', fetchJsonTimed: 'auditJSON' }, true).replace('Zf: Zf()', 'deviceFp: Zf()'))
  code = functionBody(code, 'Uu', 'Z1(y4).use(Bu).mount("#app");void yy();void Yo().catch(()=>{});void Io().catch(()=>{});')
  code = exact(code, 'ge(k4,ed(rp(n.value.promo||{})),null,16)', '(n.value.promo?.url||n.value.promo?.image||n.value.promo?.cover||n.value.promo?.text)?ge(k4,ed(rp(n.value.promo||{})),null,16):Be("",true)')
  code = exact(code, 'ge(X4,ed(rp(n.value.floatBanner||{})),null,16)', 'n.value.floatBanner?.url?ge(X4,ed(rp(n.value.floatBanner||{})),null,16):Be("",true)')
  code = exact(code, 'c0(()=>{!p.value&&Vo()&&(n.value=!0,Ho())})', 'y0(()=>He.ready,()=>{!p.value&&Vo()&&(n.value=!0,Ho())},{immediate:true})')
  code = exact(code, 'J("div",s4,[ge(o),', 'J("div",s4,[se(t).error?D("section",{role:"status",style:{padding:"12px",background:"#493712",color:"white",fontSize:"14px"}},[f0(se(t).error),D("button",{onClick:()=>yy(),style:{marginLeft:"12px",padding:"4px 12px"}},"重试")]):Be("",true),ge(o),')
  const start = ',l=["oio禁漫","免费看黄片","新葡京","海角社区","同城约炮","新葡京"]'
  const end = ',w=he(()=>String(i.value.name'
  assert.equal(code.split(start).length, 2)
  assert.equal(code.split(end).length, 2)
  const from = code.indexOf(start), to = code.indexOf(end, from)
  assert.ok(to > from)
  code = code.slice(0, from) + ';function s(name){return new Map((a.value.apps||[]).map(app=>[app.name,app])).get(name)||null}const h=he(()=>(t.tabs.mine?.quickApps||[]).slice(0,6)),m=he(()=>(t.tabs.mine?.quickApps||[]).slice(6)),x=he(()=>[...new Set(a.value.categoryApps?.byCategory?.["官方推荐"]||[])].map(s).filter(Boolean).slice(0,5))' + code.slice(to)
  code = exact(code, 'D("section",x3,', '(n.tabs.featured?.ad?.name&&n.tabs.featured?.ad?.url)?D("button",{class:"featured-ad",style:{display:"block",width:"calc(100% - .64rem)",margin:".24rem .32rem",padding:".24rem",background:"var(--dw-surface)",color:"var(--dw-cyan)",border:"1px solid var(--dw-line)",borderRadius:".12rem",textAlign:"left"},onClick:()=>Rp(n.tabs.featured.ad,"featuredAd")},[D("strong",null,n.tabs.featured.ad.name),D("span",null," "+(n.tabs.featured.ad.viewers||""))]):Be("",true),D("section",x3,')
  return code
}
