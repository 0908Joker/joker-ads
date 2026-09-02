import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const REPO_ROOT = ROOT
export const ADMIN_ROOT = path.join(ROOT, 'admin')
export const SITE_DATA_DIR = process.env.SITE_DATA_DIR || path.join(ADMIN_ROOT, 'data')
export const LIVE_DIR = path.join(SITE_DATA_DIR, 'live')
export const DRAFT_DIR = path.join(SITE_DATA_DIR, 'draft')
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ADMIN_ROOT, 'uploads')
export const DB_PATH = process.env.ADMIN_DB_PATH || path.join(ADMIN_ROOT, 'data', 'admin.sqlite')
export const PUBLIC_DIR = path.join(ADMIN_ROOT, 'public')

export function ensureDirs() {
  for (const dir of [LIVE_DIR, DRAFT_DIR, UPLOAD_DIR, path.join(UPLOAD_DIR, 'popups'), path.join(UPLOAD_DIR, 'icons'), path.join(UPLOAD_DIR, 'promo')]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export const JSON_FILES = ['config.json', 'popups.json', 'tabs.json', 'meta.json']
