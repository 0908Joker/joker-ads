import crypto from 'node:crypto'
import { getDb, now } from './db.mjs'

export const SEED_NUMERIC = '1000147271297'
export const SEED_CUSTOMER_ID = `DW${SEED_NUMERIC}`
export const CARD_COOKIE = 'dw_card'
const TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 730

export function normalizeInviteCode(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const dw = s.match(/^DW(\d{13})$/i)
  if (dw) return dw[1]
  return s.replace(/\s+/g, '')
}

export function cardCookie(token, req, maxAgeSec = TOKEN_MAX_AGE_SEC) {
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https')
  const parts = [
    `${CARD_COOKIE}=${encodeURIComponent(token || '')}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function newNumericId(db) {
  for (let i = 0; i < 24; i++) {
    const n = `1${[...crypto.randomBytes(16)].map((b) => String(b % 10)).join('').slice(0, 12)}`
    const hit = db.prepare('SELECT 1 AS o FROM customers WHERE id = ? OR invite_code = ?').get(`DW${n}`, n)
    if (!hit) return n
  }
  throw new Error('无法分配客户ID')
}

function newCardNo(db) {
  const t = String(Date.now()).slice(-6)
  for (let i = 0; i < 24; i++) {
    const no = `DW-CARD-${t}${crypto.randomBytes(3).toString('hex')}`
    if (!db.prepare('SELECT 1 AS o FROM identity_cards WHERE card_no = ?').get(no)) return no
  }
  throw new Error('无法分配身份卡号')
}

function inviteCountOf(db, customerId) {
  return db.prepare('SELECT COUNT(*) AS c FROM customers WHERE invited_by = ?').get(customerId).c
}

function publicCard(row, extras = {}) {
  return {
    customerId: row.customer_id || row.id,
    cardNo: row.card_no,
    inviteCode: row.invite_code,
    invitedBy: row.invited_by || '',
    status: row.status || 'active',
    issuedAt: row.issued_at || row.created_at,
    ...extras,
  }
}

function loadByCustomerId(db, customerId) {
  return db.prepare(`
    SELECT c.id, c.invite_code, c.invited_by, c.device_fp, c.created_at, c.last_seen_at,
           i.card_no, i.status, i.issued_at
    FROM customers c
    JOIN identity_cards i ON i.customer_id = c.id
    WHERE c.id = ?
  `).get(customerId)
}

function issueToken(db, customerId) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO customer_tokens (token, customer_id, created_at) VALUES (?, ?, ?)').run(token, customerId, now())
  const extras = db.prepare(`
    SELECT token FROM customer_tokens WHERE customer_id = ? ORDER BY created_at DESC
  `).all(customerId)
  extras.slice(5).forEach((row) => {
    db.prepare('DELETE FROM customer_tokens WHERE token = ?').run(row.token)
  })
  return token
}

function touch(db, customerId) {
  db.prepare('UPDATE customers SET last_seen_at = ? WHERE id = ?').run(now(), customerId)
}

export function findInviterId(db, inviteCode) {
  const code = normalizeInviteCode(inviteCode)
  if (!code) return ''
  const row = db.prepare('SELECT id FROM customers WHERE invite_code = ? OR id = ?').get(code, `DW${code}`)
  return row?.id || ''
}

function createPair(db, { deviceFp, invitedBy }) {
  const numeric = newNumericId(db)
  const customerId = `DW${numeric}`
  const cardNo = newCardNo(db)
  const t = now()
  db.prepare(`
    INSERT INTO customers (id, invite_code, invited_by, device_fp, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(customerId, numeric, invitedBy || null, deviceFp, t, t)
  db.prepare(`
    INSERT INTO identity_cards (card_no, customer_id, status, issued_at)
    VALUES (?, ?, 'active', ?)
  `).run(cardNo, customerId, t)
  return loadByCustomerId(db, customerId)
}

export function claimCustomer({ deviceFp, inviteCode, cardToken }) {
  const db = getDb()
  const fp = String(deviceFp || '').trim().slice(0, 128)
  if (!fp || fp.length < 8) {
    const err = new Error('缺少设备指纹')
    err.status = 400
    throw err
  }
  if (fp.startsWith('seed:')) {
    const err = new Error('系统邀请身份不可领取')
    err.status = 403
    throw err
  }

  const byToken = cardToken
    ? db.prepare('SELECT customer_id FROM customer_tokens WHERE token = ?').get(cardToken)
    : null
  if (byToken) {
    if (byToken.customer_id === SEED_CUSTOMER_ID) {
      const err = new Error('系统邀请身份不可登录')
      err.status = 403
      throw err
    }
    touch(db, byToken.customer_id)
    const row = loadByCustomerId(db, byToken.customer_id)
    return { ...publicCard(row, { inviteCount: inviteCountOf(db, byToken.customer_id) }), token: cardToken, isNew: false }
  }

  const byFp = db.prepare('SELECT id FROM customers WHERE device_fp = ?').get(fp)
  if (byFp) {
    if (byFp.id === SEED_CUSTOMER_ID) throw Object.assign(new Error('系统邀请身份不可领取'), { status: 403 })
    touch(db, byFp.id)
    const row = loadByCustomerId(db, byFp.id)
    const token = issueToken(db, byFp.id)
    return { ...publicCard(row, { inviteCount: inviteCountOf(db, byFp.id) }), token, isNew: false }
  }

  let invitedBy = findInviterId(db, inviteCode)
  const tx = db.transaction(() => {
    try {
      const row = createPair(db, { deviceFp: fp, invitedBy })
      if (invitedBy && invitedBy === row.id) {
        db.prepare('UPDATE customers SET invited_by = NULL WHERE id = ?').run(row.id)
        row.invited_by = null
      }
      const token = issueToken(db, row.id)
      return { ...publicCard(row, { inviteCount: 0 }), token, isNew: true }
    } catch (e) {
      if (!String(e?.message || '').includes('UNIQUE')) throw e
      const again = db.prepare('SELECT id FROM customers WHERE device_fp = ?').get(fp)
      if (!again) throw e
      touch(db, again.id)
      const row = loadByCustomerId(db, again.id)
      const token = issueToken(db, again.id)
      return { ...publicCard(row, { inviteCount: inviteCountOf(db, again.id) }), token, isNew: false }
    }
  })
  return tx()
}

export function readCustomerByToken(cardToken) {
  if (!cardToken) return null
  const db = getDb()
  const hit = db.prepare('SELECT customer_id FROM customer_tokens WHERE token = ?').get(cardToken)
  if (!hit || hit.customer_id === SEED_CUSTOMER_ID) return null
  touch(db, hit.customer_id)
  const row = loadByCustomerId(db, hit.customer_id)
  const invited = db.prepare('SELECT COUNT(*) AS c FROM customers WHERE invited_by = ?').get(hit.customer_id).c
  return publicCard(row, { inviteCount: invited })
}

export function listCustomers({ limit = 100, offset = 0 } = {}) {
  const db = getDb()
  const rows = db.prepare(`
    SELECT c.id, c.invite_code, c.invited_by, c.created_at, c.last_seen_at,
           i.card_no, i.status, i.issued_at
    FROM customers c
    JOIN identity_cards i ON i.customer_id = c.id
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)
  const total = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c
  return { total, customers: rows }
}
