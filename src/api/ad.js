import { apiFetch } from './client.js'

export async function fetchAllAds() {
  return apiFetch('/ad/all')
}

export function resolveAdTarget(item) {
  return item?.url || item?.orgUrl || item?.signUrl || ''
}

const ORIGIN_API_PATH = /^https?:\/\/[^/]+\/api\/v1(\/.+)$/i

export function trackAdSign(signUrl) {
  if (!signUrl) return
  const path = String(signUrl).match(ORIGIN_API_PATH)?.[1]
  if (!path) return
  apiFetch(path).catch(() => {})
}

function trackAdClick(item, slot = '') {
  const url = resolveAdTarget(item)
  if (!url) return
  fetch('/api/public/ad-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, name: item?.name || '', url }),
    keepalive: true,
  }).catch(() => {})
}

export function openAd(item, slot = '') {
  const target = resolveAdTarget(item)
  if (!/^https?:/i.test(target)) return false
  trackAdSign(item?.signUrl)
  trackAdClick(item, slot)
  window.open(target, '_blank', 'noopener,noreferrer')
  return true
}
