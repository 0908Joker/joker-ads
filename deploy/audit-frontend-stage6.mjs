import { sourceFunction } from './audit-frontend-stage2.mjs'
import { replaceFunction } from './audit-frontend-stage4.mjs'

export function patchStageSix(code, { exact }) {
  // Bootstrap occurs before appended code: declarations must not reset an
  // already-started load/timer, and helpers must be hoisted functions.
  code += '\nvar auditSiteFlight,auditSiteLoaded,auditSiteCleanup;'
  const bindings = {
    siteConfig: 'rt', emptySiteConfig: 'auditEmpty', fetchJsonTimed: 'auditJSON',
    applyApiSession: 'sy', readonly: 'Zt', loadSiteConfig: 'yy',
    siteConfigFlight: 'auditSiteFlight', siteConfigLoaded: 'auditSiteLoaded',
    siteSyncCleanup: 'auditSiteCleanup', applySiteConfig: 'auditApplySite', startSiteConfigSync: 'auditSiteStart',
  }
  code = replaceFunction(code, 'yy', sourceFunction('src/composables/useSiteConfig.js', 'loadSiteConfig', bindings))
  for (const name of ['applySiteConfig', 'startSiteConfigSync']) code += '\n' + sourceFunction('src/composables/useSiteConfig.js', name, bindings)
  code = exact(code, 'void yy();void Yo()', 'void yy();auditSiteStart();void Yo()')
  code = exact(code, 'const t=e,a=It(t),n=t.image||"";', 'const t=e,a=he(()=>It(t)),n=he(()=>t.image||"");')
  code = exact(code, 'function i(p){if(!a){p.preventDefault();return}auditTrack(t,"promo")}', 'function i(p){if(!a.value){p.preventDefault();return}auditTrack(t,"promo")}')
  code = exact(code, 'r.icon&&!a[l]', 'r.icon&&!a[r.icon]')
  code = exact(code, 'onError:f=>a[l]=!0', 'onError:f=>a[r.icon]=!0')
  const header = { props: 'e', activeCategory: 'n', activeMode: 'i', selectCategory: 'd', selectMode: 'o', syncHeaderSelection: 'auditSyncHeaderSelection' }
  code = exact(code, 'const a=l0(),n=pe("官方推荐"),i=pe("recommend"),p=t;', 'const a=l0(),n=pe("官方推荐"),i=pe("recommend"),p=t;' + sourceFunction('src/components/HeroHeader.vue', 'syncHeaderSelection', header) + ';y0(()=>[e.categories,e.modes],auditSyncHeaderSelection,{immediate:true});')
  const popup = { sessionQueueDone: 't', showAt: 'm', index: 'r', queueLen: 'h', refreshPopupConfig: 'auditRefreshPopupConfig' }
  code = exact(code, 'const auditCurrentAd=pe(null);', 'const auditCurrentAd=pe(null);' + sourceFunction('src/components/AdPopup.vue', 'refreshPopupConfig', popup))
  code = exact(code, 'return En(()=>{++n;clearTimeout(auditNextTimer)}),c0', 'return y0(()=>[d.value,o.value],auditRefreshPopupConfig),En(()=>{++n;clearTimeout(auditNextTimer)}),c0')
  return code
}
