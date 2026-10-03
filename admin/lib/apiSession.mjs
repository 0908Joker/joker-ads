const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function isJwt(token) {
  return JWT_RE.test(String(token || '').trim())
}

export function uidFromJwt(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return ''
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
    return json.uid != null ? String(json.uid) : ''
  } catch {
    return ''
  }
}

export function publicApiSession(sess) {
  const token = sess?.token || ''
  return {
    at: sess?.at || '',
    uid: sess?.uid || uidFromJwt(token),
    resBase: sess?.resBase || '',
    hasToken: Boolean(token),
    tokenLen: token.length,
    tokenPreview: token ? `${token.slice(0, 12)}…${token.slice(-6)}` : '',
  }
}

export function normalizeApiSession(input, previous = {}) {
  const token = String(input?.token || '').trim()
  if (!isJwt(token)) throw new Error('token 必须是 JWT')
  const resBase = String(input?.resBase || previous.resBase || 'https://d17e80montytxe.cloudfront.net').replace(/\/$/, '')
  const uid = String(input?.uid || uidFromJwt(token) || previous.uid || '')
  return {
    at: new Date().toISOString(),
    token,
    uid,
    resBase,
  }
}
