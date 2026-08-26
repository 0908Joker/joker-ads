import session from '../data/api-session.json'
import { unwrapApiPayload } from './decrypt.js'

const PID = 'FBI'
const DEFAULT_BASES = [
  'https://deuwy.jcd9nw.com',
  'https://4p3kb.et8h6.cc',
  'https://34.92.209.217:16888',
  'https://180.188.198.189:16888',
]

let activeBase = null
let bases = [...DEFAULT_BASES]
let lastFetchAt = null

function apiRoot(base) {
  const b = (base || activeBase || bases[0]).replace(/\/$/, '')
  return `${b}/api/v1`
}

/** Production (GitHub Pages) uses HTTPS VPS reverse proxy; local uses Vite proxy. */
function proxyOrigin() {
  const fromEnv = (import.meta.env.VITE_API_PROXY_ORIGIN || '').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window === 'undefined') return ''
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return ''
  return ''
}

function useProxy() {
  if (typeof window === 'undefined') return false
  if (proxyOrigin()) return true
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

function requestPath(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (useProxy()) {
    const origin = proxyOrigin()
    return origin ? `${origin}/api-proxy${p}` : `/api-proxy${p}`
  }
  return `${apiRoot()}${p}`
}

/** Rewrite origin API stream URLs onto the VPS proxy (same host as m3u8). */
export function proxyMediaUrl(url) {
  if (!url || !useProxy()) return url
  const origin = proxyOrigin()
  const prefix = origin ? `${origin}/api-proxy` : '/api-proxy'
  return String(url).replace(/^https?:\/\/[^/]+\/api\/v1/i, prefix)
}

// Browsers reject the IP-hosted bases on cert mismatch, so try domain bases first.
function isIpHost(base) {
  try {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(new URL(base).hostname)
  } catch {
    return false
  }
}

function authHeaders() {
  const token =
    session.token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') ||
    ''
  if (!token) return {}
  // Only `token` is in the origin's Access-Control-Allow-Headers; sending
  // `Authorization` too would fail the browser preflight.
  return { token }
}

async function ping(base) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    let url
    if (useProxy()) {
      const origin = proxyOrigin()
      url = `${origin}/api-proxy/speedtest?base=${encodeURIComponent(base)}`
      if (!origin) url = `/api-proxy/speedtest?base=${encodeURIComponent(base)}`
    } else {
      url = `${apiRoot(base)}/speedtest`
    }
    const res = await fetch(url, { signal: ctrl.signal, method: 'GET' })
    clearTimeout(t)
    return res.ok
  } catch {
    clearTimeout(t)
    return false
  }
}

export async function pickApiBase(candidates = DEFAULT_BASES) {
  const unique = [...new Set(candidates.filter(Boolean))]
  bases = [...unique.filter((b) => !isIpHost(b)), ...unique.filter(isIpHost)]
  for (const base of bases) {
    if (await ping(base)) {
      activeBase = base
      return base
    }
  }
  activeBase = bases[0]
  return activeBase
}

export async function apiFetch(path, options = {}) {
  if (!activeBase) await pickApiBase()
  const url = requestPath(path)
  const sep = url.includes('?') ? '&' : '?'
  const withPid = url.includes('pid=') ? url : `${url}${sep}pid=${PID}`
  lastFetchAt = new Date().toISOString()
  const res = await fetch(withPid, {
    ...options,
    headers: {
      Accept: 'application/json',
      // k=3 selects the payload scheme our decryptCipher understands; without it
      // the server encrypts responses with a scheme we cannot read.
      t: '3',
      k: '3',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  const json = await res.json()
  if (json.errorCode && json.errorCode !== 0) {
    throw new Error(json.message || `API error ${json.errorCode}`)
  }
  const unwrapped = unwrapApiPayload(json)
  return { ...json, data: unwrapped ?? json.data, _live: true, _decrypted: unwrapped != null }
}

export function getActiveBase() {
  return activeBase
}

export function getLastFetchAt() {
  return lastFetchAt
}

export { PID, DEFAULT_BASES }
