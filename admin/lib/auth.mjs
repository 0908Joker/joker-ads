import crypto from 'node:crypto'
import { getDb, now, hashPassword, verifyPassword, writeLog } from './db.mjs'
import { verifyTotp } from './totp.mjs'

const SESSION_DAYS = 7
const MIN_PASSWORD_LENGTH = 10
const loginFailures = new Map()

export const READ_SCOPES = {
  super: new Set(['dashboard', 'popups', 'promo', 'float', 'apps', 'categories', 'tabs', 'logs', 'stats', 'settings']),
  ad_admin: new Set(['dashboard', 'popups', 'promo', 'float', 'apps', 'categories', 'tabs', 'stats']),
  readonly: new Set(['dashboard', 'popups', 'promo', 'float', 'apps', 'categories', 'tabs', 'stats']),
}

export const WRITE_SCOPES = {
  super: new Set(['popups', 'promo', 'float', 'apps', 'categories', 'tabs', 'settings', 'publish', 'upload']),
  ad_admin: new Set(['popups', 'promo', 'float', 'apps', 'categories', 'tabs', 'publish', 'upload']),
  readonly: new Set([]),
}

export function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        if (idx === -1) return [part, '']
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))]
      }),
  )
}

export function sessionCookie(token, req, maxAgeSec) {
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https')
  const parts = [
    `dw_admin=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSec}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || ''
}

function loginKey(req, username) {
  return `${clientIp(req)}:${username}`
}

function recordLoginFailure(req, username) {
  const key = loginKey(req, username)
  const row = loginFailures.get(key) || { count: 0, at: Date.now() }
  row.count += 1
  row.at = Date.now()
  loginFailures.set(key, row)
}

function clearLoginFailure(req, username) {
  loginFailures.delete(loginKey(req, username))
}

function loginLimited(req, username) {
  const row = loginFailures.get(loginKey(req, username))
  if (!row) return false
  if (Date.now() - row.at > 15 * 60 * 1000) {
    loginFailures.delete(loginKey(req, username))
    return false
  }
  return row.count >= 8
}

export function adminSafe(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    mustChangePassword: !!row.must_change_password,
    totpEnabled: !!row.totp_enabled,
  }
}

export function sessionUser(req) {
  const token = cookies(req).dw_admin
  if (!token) return null
  const db = getDb()
  const session = db.prepare(`
    SELECT s.*, a.*
    FROM sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token = ? AND a.active = 1
  `).get(token)
  if (!session) return null
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return null
  }
  return adminSafe(session)
}

export function requireAuth(req, res, next) {
  const user = sessionUser(req)
  if (!user) return res.status(401).json({ error: '未登录' })
  req.admin = user
  next()
}

export function requireRead(scope) {
  return (req, res, next) => {
    const allowed = READ_SCOPES[req.admin.role] || new Set()
    if (!allowed.has(scope)) return res.status(403).json({ error: '无权限' })
    next()
  }
}

export function requireWrite(scope) {
  return (req, res, next) => {
    const allowed = WRITE_SCOPES[req.admin.role] || new Set()
    if (!allowed.has(scope)) return res.status(403).json({ error: '无写入权限' })
    next()
  }
}

export function handleLogin(req, res) {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  const totp = String(req.body?.totp || '').trim()
  if (loginLimited(req, username)) return res.status(429).json({ error: '登录失败次数过多，请稍后再试' })
  const db = getDb()
  const row = db.prepare('SELECT * FROM admins WHERE username = ? AND active = 1').get(username)
  if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) {
    recordLoginFailure(req, username)
    return res.status(401).json({ error: '账号或密码错误' })
  }
  if (row.totp_enabled) {
    if (!totp || !verifyTotp(row.totp_secret, totp)) {
      recordLoginFailure(req, username)
      return res.status(401).json({ error: '动态验证码错误', needTotp: true })
    }
  }
  clearLoginFailure(req, username)
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(token, row.id, expires, now())
  writeLog({ admin: row, action: '管理员登录', targetType: 'auth', ip: clientIp(req) })
  res.setHeader('Set-Cookie', sessionCookie(token, req, SESSION_DAYS * 24 * 60 * 60))
  res.json({ user: adminSafe(row) })
}

export function handleLogout(req, res) {
  const token = cookies(req).dw_admin
  if (token) getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token)
  if (req.admin) writeLog({ admin: req.admin, action: '退出登录', targetType: 'auth', ip: clientIp(req) })
  res.setHeader('Set-Cookie', sessionCookie('', req, 0))
  res.json({ ok: true })
}

export function handleChangePassword(req, res) {
  const oldPassword = String(req.body?.oldPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `新密码至少 ${MIN_PASSWORD_LENGTH} 位` })
  }
  const db = getDb()
  const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id)
  if (!verifyPassword(oldPassword, row.password_salt, row.password_hash)) {
    return res.status(400).json({ error: '原密码错误' })
  }
  const { salt, hash } = hashPassword(newPassword)
  db.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(hash, salt, now(), row.id)
  writeLog({ admin: req.admin, action: '修改登录密码', targetType: 'admins', targetId: row.id, ip: clientIp(req) })
  res.json({ ok: true })
}

export async function loadTotp() {
  return import('./totp.mjs')
}

export { clientIp, MIN_PASSWORD_LENGTH, SESSION_DAYS }
