import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { DB_PATH, ensureDirs } from './paths.mjs'

let db

export function getDb() {
  if (db) return db
  ensureDirs()
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  seedAdmin(db)
  return db
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ad_admin',
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT,
      admin_name TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      detail TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ad_events (
      id TEXT PRIMARY KEY,
      slot TEXT,
      item_name TEXT,
      event_type TEXT NOT NULL,
      url TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

export function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export function now() {
  return new Date().toISOString()
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 210000, 32, 'sha256').toString('hex')
  return { salt, hash }
}

export function verifyPassword(password, salt, hash) {
  const next = hashPassword(password, salt).hash
  return crypto.timingSafeEqual(Buffer.from(next, 'hex'), Buffer.from(hash, 'hex'))
}

function seedAdmin(database) {
  const count = database.prepare('SELECT COUNT(*) AS c FROM admins').get().c
  if (count > 0) return
  const username = process.env.ADMIN_BOOTSTRAP_USER || 'admin'
  const password = process.env.ADMIN_BOOTSTRAP_PASS || 'ChangeMeNow1!'
  const { salt, hash } = hashPassword(password)
  const adminId = id('adm')
  database.prepare(`
    INSERT INTO admins (id, username, password_hash, password_salt, role, active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'super', 1, 1, ?, ?)
  `).run(adminId, username, hash, salt, now(), now())
  console.log(`[admin] bootstrap user "${username}" created (must change password on first login)`)
}

export function writeLog({ admin, action, targetType = '', targetId = '', detail = '', ip = '' }) {
  getDb().prepare(`
    INSERT INTO operation_logs (id, admin_id, admin_name, action, target_type, target_id, detail, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id('log'), admin?.id || '', admin?.username || '', action, targetType, targetId, detail, ip, now())
}
