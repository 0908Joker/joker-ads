#!/usr/bin/env node
/** Upsert one admin: node scripts/set-users.mjs <username> <password> [role]
 * Requires password via CLI/env — never hardcode secrets in repo.
 * Env: ADMIN_DB_PATH, or ADS_KING_SET_USER_PASS as password fallback.
 */
import { getDb, hashPassword, id, now } from '../lib/db.mjs'

const username = process.argv[2]
const password = process.argv[3] || process.env.ADS_KING_SET_USER_PASS || ''
const role = process.argv[4] || 'ad_admin'

if (!username || !password || password.length < 8) {
  console.error('Usage: node scripts/set-users.mjs <username> <password>=8chars [role]')
  process.exit(1)
}

function upsertUser(db, { username, password, role }) {
  const { salt, hash } = hashPassword(password)
  const ts = now()
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username)
  if (existing) {
    db.prepare(`
      UPDATE admins
      SET password_hash = ?, password_salt = ?, role = ?, active = 1,
          must_change_password = 1, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, role, ts, existing.id)
    return { username, role, action: 'updated' }
  }
  const adminId = id('adm')
  db.prepare(`
    INSERT INTO admins (id, username, password_hash, password_salt, role, active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
  `).run(adminId, username, hash, salt, role, ts, ts)
  return { username, role, action: 'created' }
}

const db = getDb()
const result = upsertUser(db, { username, password, role })
console.log(`${result.action}: ${result.username} (${result.role})`)
