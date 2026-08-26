import { apiFetch } from './client.js'

export async function fetchAllAds() {
  return apiFetch('/ad/all')
}

/**
 * `ad/sign` only records the click and answers `{}` — the advertiser page lives
 * in `url`. Opening signUrl showed users a blank JSON body, or errorCode 1067
 * ("此ip已经禁止登陆") from the IPs the origin has banned.
 */
export function resolveAdTarget(item) {
  return item?.url || item?.orgUrl || item?.signUrl || ''
}

const ORIGIN_API_PATH = /^https?:\/\/[^/]+\/api\/v1(\/.+)$/i

/** Fire the attribution ping through the proxy, which has a clean egress IP. */
export function trackAdSign(signUrl) {
  if (!signUrl) return
  const path = String(signUrl).match(ORIGIN_API_PATH)?.[1]
  if (!path) return
  apiFetch(path).catch(() => {})
}

export function openAd(item) {
  const target = resolveAdTarget(item)
  if (!/^https?:/i.test(target)) return false
  trackAdSign(item?.signUrl)
  window.open(target, '_blank', 'noopener,noreferrer')
  return true
}
