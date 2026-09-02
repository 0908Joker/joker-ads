import fs from 'node:fs'
import path from 'node:path'
import { DRAFT_DIR, LIVE_DIR, ensureDirs } from './paths.mjs'

export function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJsonAtomic(target, value, backup = true) {
  ensureDirs()
  const payload = JSON.stringify(value, null, 2) + '\n'
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  const fd = fs.openSync(tmp, 'w', 0o600)
  try {
    fs.writeFileSync(fd, payload, 'utf8')
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  try {
    if (backup && fs.existsSync(target)) fs.copyFileSync(target, `${target}.bak`)
    fs.renameSync(tmp, target)
    if (process.platform !== 'win32') {
      const dirFd = fs.openSync(path.dirname(target), 'r')
      try {
        fs.fsyncSync(dirFd)
      } finally {
        fs.closeSync(dirFd)
      }
    }
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true })
    } catch {}
    throw err
  }
}

export function readDraft(name) {
  return readJson(path.join(DRAFT_DIR, name))
}

export function readLive(name) {
  return readJson(path.join(LIVE_DIR, name))
}

export function writeDraft(name, value) {
  writeJsonAtomic(path.join(DRAFT_DIR, name), value)
}

export function writeLive(name, value) {
  writeJsonAtomic(path.join(LIVE_DIR, name), value)
}

export function publishAll() {
  ensureDirs()
  const names = ['config.json', 'popups.json', 'tabs.json']
  for (const name of names) {
    const draftPath = path.join(DRAFT_DIR, name)
    const livePath = path.join(LIVE_DIR, name)
    if (!fs.existsSync(draftPath)) continue
    const data = readJson(draftPath)
    if (data == null) throw new Error(`invalid draft: ${name}`)
    writeJsonAtomic(livePath, data)
  }
  const meta = readJson(path.join(DRAFT_DIR, 'meta.json'), { version: 0 })
  meta.version = Number(meta.version || 0) + 1
  meta.publishedAt = new Date().toISOString()
  writeJsonAtomic(path.join(LIVE_DIR, 'meta.json'), meta)
  writeJsonAtomic(path.join(DRAFT_DIR, 'meta.json'), meta)
  return meta
}

export function syncDraftFromLive() {
  ensureDirs()
  for (const name of ['config.json', 'popups.json', 'tabs.json', 'meta.json']) {
    const livePath = path.join(LIVE_DIR, name)
    const draftPath = path.join(DRAFT_DIR, name)
    if (fs.existsSync(livePath)) {
      fs.copyFileSync(livePath, draftPath)
    }
  }
}
