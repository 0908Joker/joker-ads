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

function useProxy() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function requestPath(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (useProxy()) return `/api-proxy${p}`
  if (typeof window !== 'undefined') return `/api/v1${p}`
  return `${apiRoot()}${p}`
}

function authHeaders() {
  const token =
    session.token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') ||
    ''
  if (!token) return {}
  return { Authorization: token, token }
}

async function ping(base) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const url = useProxy()
      ? `/api-proxy/speedtest?base=${encodeURIComponent(base)}`
      : `${apiRoot(base)}/speedtest`
    const res = await fetch(url, { signal: ctrl.signal, method: 'GET' })
    clearTimeout(t)
    return res.ok
  } catch {
    clearTimeout(t)
    return false
  }
}

export async function pickApiBase(candidates = DEFAULT_BASES) {
  bases = [...new Set(candidates.filter(Boolean))]
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
