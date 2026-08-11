import { apiFetch } from './client.js'

export async function fetchAllAds() {
  return apiFetch('/ad/all')
}

export function openAdSign(signUrl) {
  if (!signUrl) return
  window.open(signUrl, '_blank', 'noopener,noreferrer')
}

export function resolveAdTarget(item) {
  return item?.signUrl || item?.url || item?.orgUrl || ''
}
