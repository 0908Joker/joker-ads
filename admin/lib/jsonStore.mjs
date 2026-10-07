import fs from 'node:fs'
import path from 'node:path'
import { DRAFT_DIR, LIVE_DIR, SITE_DATA_DIR, ensureDirs } from './paths.mjs'
import { validatePart, validatePublished } from './configValidation.mjs'

const SNAPSHOT = path.join(SITE_DATA_DIR, 'published.json')
const BACKUPS = path.join(SITE_DATA_DIR, 'private-backups')
const KEYS = { 'config.json': 'config', 'popups.json': 'popups', 'tabs.json': 'tabs', 'api-session.json': 'apiSession', 'meta.json': 'meta' }

export function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return fallback }
}
function strictJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { throw Object.assign(new Error('配置文件无法读取或解析: ' + path.basename(file)), { status: 400 }) }
}
export function writeJsonAtomic(target, value, backup = true) {
  ensureDirs()
  const tmp = target + '.' + process.pid + '.' + Date.now() + '.tmp'
  try {
    const fd = fs.openSync(tmp, 'w', 0o600)
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    if (backup && fs.existsSync(target)) {
      fs.mkdirSync(BACKUPS, { recursive: true, mode: 0o700 })
      fs.copyFileSync(target, path.join(BACKUPS, path.basename(path.dirname(target)) + '-' + path.basename(target) + '.bak'))
    }
    fs.renameSync(tmp, target) // sole commit point; readers see all-old or all-new.
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }) } catch {}
    throw error
  }
  // A failure after commit must not masquerade as an unpublished transaction.
  if (process.platform !== 'win32') {
    try {
      const fd = fs.openSync(path.dirname(target), 'r')
      try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    } catch { console.warn('[config] directory sync unavailable after atomic commit') }
  }
}
export function readPublished() {
  if (!fs.existsSync(SNAPSHOT)) {
    const first = {}
    for (const [file, key] of Object.entries(KEYS)) {
      const p = path.join(LIVE_DIR, file)
      first[key] = fs.existsSync(p) ? strictJson(p) : key === 'meta' ? { version: 0 } : {}
    }
    validatePublished(first)
    writeJsonAtomic(SNAPSHOT, first, false) // import only LIVE, never draft.
  }
  return validatePublished(strictJson(SNAPSHOT))
}
export function readDraft(name) { return readJson(path.join(DRAFT_DIR, name)) }
export function readLive(name) { return KEYS[name] ? readPublished()[KEYS[name]] : null }
export function writeDraft(name, value) {
  if (!KEYS[name]) throw new Error('Unknown configuration part')
  if (['config', 'popups', 'tabs'].includes(KEYS[name])) validatePart(KEYS[name], value)
  writeJsonAtomic(path.join(DRAFT_DIR, name), value)
}
function commit(bundle) {
  validatePublished(bundle)
  writeJsonAtomic(SNAPSHOT, bundle)
  return bundle.meta
}
export function writeLive(name, value) {
  if (!KEYS[name]) throw new Error('Unknown configuration part')
  const bundle = readPublished()
  bundle[KEYS[name]] = value
  return commit(bundle)
}
function nextMeta(previous) {
  return { ...previous, version: previous.version + 1, publishedAt: new Date().toISOString() }
}
// Published is the single authority. Never publish unrelated pending draft parts.
// The draft mirror is compatibility/backup only, and cannot make a committed save fail.
export function savePublishedPart(part, value) {
  if (!['config', 'popups', 'tabs'].includes(part)) throw new Error('Unknown configuration part')
  validatePart(part, value)
  const bundle = readPublished()
  bundle[part] = value
  bundle.meta = nextMeta(bundle.meta)
  const meta = commit(bundle)
  let draftWarning = false
  try { writeDraft(part + '.json', value); writeDraft('meta.json', meta) }
  catch { draftWarning = true; console.warn('[config] live saved; compatibility draft mirror unavailable') }
  return { published: true, meta, draftWarning }
}
export function publishApiSession(value) {
  const bundle = readPublished()
  bundle.apiSession = value
  bundle.meta = nextMeta(bundle.meta)
  validatePublished(bundle)
  writeDraft('api-session.json', value)
  return commit(bundle)
}
export function publishAll() {
  const bundle = readPublished()
  // Parse and validate every draft BEFORE performing any live write.
  for (const [file, key] of Object.entries(KEYS)) {
    if (key === 'meta') continue
    const filePath = path.join(DRAFT_DIR, file)
    if (fs.existsSync(filePath)) bundle[key] = strictJson(filePath)
  }
  bundle.meta = nextMeta(bundle.meta)
  return commit(bundle)
}
export function syncDraftFromLive() {
  const bundle = readPublished()
  for (const [file, key] of Object.entries(KEYS)) writeDraft(file, bundle[key])
}
