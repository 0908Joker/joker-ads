import baked from '../data/api-session.json'

const FALLBACK_RES = 'https://d17e80montytxe.cloudfront.net'

const state = {
  token: String(baked.token || ''),
  resBase: String(baked.resBase || FALLBACK_RES).replace(/\/$/, ''),
  uid: String(baked.uid || ''),
  at: String(baked.at || ''),
  source: baked.token ? 'bundled' : 'none',
}

export function applyApiSession(raw, source = 'runtime') {
  if (!raw || typeof raw !== 'object') return getApiSessionMeta()
  if (raw.token) {
    state.token = String(raw.token)
    state.source = source
  }
  if (raw.resBase) state.resBase = String(raw.resBase).replace(/\/$/, '')
  if (raw.uid) state.uid = String(raw.uid)
  if (raw.at) state.at = String(raw.at)
  if (!state.uid && state.token) state.uid = uidFromJwt(state.token)
  return getApiSessionMeta()
}

export function getApiAuth() {
  if (state.token) return { token: state.token, source: state.source }
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('token') || ''
    if (token) return { token, source: 'localStorage' }
  }
  return { token: '', source: 'none' }
}

export function getResBase() {
  return state.resBase || FALLBACK_RES
}

export function getApiSessionMeta() {
  return {
    source: state.source,
    tokenLen: state.token ? state.token.length : 0,
    uid: state.uid || uidFromJwt(state.token),
    at: state.at,
    resBase: state.resBase,
  }
}

function uidFromJwt(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return ''
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return json.uid != null ? String(json.uid) : ''
  } catch {
    return ''
  }
}
