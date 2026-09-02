import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import multer from 'multer'
import { ensureDirs, LIVE_DIR, DRAFT_DIR, UPLOAD_DIR, PUBLIC_DIR, REPO_ROOT } from './lib/paths.mjs'
import {
  readDraft,
  writeDraft,
  publishAll,
  syncDraftFromLive,
  readJson,
  readLive,
} from './lib/jsonStore.mjs'
import { getDb, id, now, hashPassword, writeLog } from './lib/db.mjs'
import {
  requireAuth,
  requireRead,
  requireWrite,
  handleLogin,
  handleLogout,
  handleChangePassword,
  sessionUser,
  clientIp,
  cookies,
  sessionCookie,
  loadTotp,
} from './lib/auth.mjs'

const HOST = process.env.ADMIN_HOST || '127.0.0.1'
const PORT = Number(process.env.ADMIN_PORT || 8790)
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'])

ensureDirs()
getDb()

const app = express()
app.set('trust proxy', true)
app.use(express.json({ limit: '4mb' }))

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const kind = String(req.query.kind || 'popup')
    const dir = path.join(UPLOAD_DIR, kind === 'icon' ? 'icons' : kind === 'promo' ? 'promo' : 'popups')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    cb(null, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (!IMAGE_EXTS.has(ext)) return cb(new Error('仅支持图片上传'))
    cb(null, true)
  },
})

function seedFromRepoIfEmpty() {
  const liveConfig = path.join(LIVE_DIR, 'config.json')
  if (fs.existsSync(liveConfig)) return
  const srcData = path.join(REPO_ROOT, 'src', 'data')
  for (const name of ['config.json', 'popups.json', 'tabs.json']) {
    const src = path.join(srcData, name)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(LIVE_DIR, name))
      fs.copyFileSync(src, path.join(DRAFT_DIR, name))
    }
  }
  writeDraft('meta.json', { version: 1, publishedAt: now() })
  syncDraftFromLive()
}

seedFromRepoIfEmpty()
if (!readDraft('meta.json')) writeDraft('meta.json', readLive('meta.json') || { version: 1 })

function getBundle() {
  return {
    config: readDraft('config.json') || {},
    popups: readDraft('popups.json') || {},
    tabs: readDraft('tabs.json') || {},
    meta: readDraft('meta.json') || { version: 1 },
  }
}

function saveBundle(part, value) {
  if (part === 'config') writeDraft('config.json', value)
  else if (part === 'popups') writeDraft('popups.json', value)
  else if (part === 'tabs') writeDraft('tabs.json', value)
  else throw new Error('unknown part')
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ads-king-admin' })
})

app.use('/data', express.static(LIVE_DIR, { etag: true, maxAge: 0, setHeaders(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
}}))

app.use('/uploads', express.static(UPLOAD_DIR, { etag: true, maxAge: '30d' }))

app.post('/api/public/ad-click', (req, res) => {
  const db = getDb()
  db.prepare(`
    INSERT INTO ad_events (id, slot, item_name, event_type, url, ip, user_agent, created_at)
    VALUES (?, ?, ?, 'click', ?, ?, ?, ?)
  `).run(
    id('evt'),
    String(req.body?.slot || '').slice(0, 80),
    String(req.body?.name || '').slice(0, 120),
    String(req.body?.url || '').slice(0, 500),
    clientIp(req),
    String(req.headers['user-agent'] || '').slice(0, 500),
    now(),
  )
  res.json({ ok: true })
})

app.post('/api/admin/login', handleLogin)
app.get('/api/admin/me', (req, res) => {
  const user = sessionUser(req)
  if (!user) return res.status(401).json({ error: '未登录' })
  res.json({ user })
})
app.post('/api/admin/logout', requireAuth, handleLogout)
app.post('/api/admin/change-password', requireAuth, handleChangePassword)

app.get('/api/admin/dashboard', requireAuth, requireRead('dashboard'), (req, res) => {
  const db = getDb()
  const clicksToday = db.prepare(`SELECT COUNT(*) AS c FROM ad_events WHERE event_type = 'click' AND created_at >= date('now')`).get().c
  const clicksTotal = db.prepare(`SELECT COUNT(*) AS c FROM ad_events WHERE event_type = 'click'`).get().c
  const logs = db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 10').all()
  const bundle = getBundle()
  res.json({
    stats: {
      apps: (bundle.config.apps || []).length,
      popups: (bundle.popups.afterEnterApp || []).length,
      gridPopups: (bundle.popups.gridPopAds || []).length,
      clicksToday,
      clicksTotal,
      version: bundle.meta?.version || 1,
    },
    logs,
  })
})

app.get('/api/admin/site-config', requireAuth, requireRead('popups'), (_req, res) => {
  res.json(getBundle())
})

app.put('/api/admin/site-config/:part', requireAuth, requireWrite('popups'), (req, res) => {
  const part = req.params.part
  if (!['config', 'popups', 'tabs'].includes(part)) return res.status(400).json({ error: 'invalid part' })
  saveBundle(part, req.body || {})
  writeLog({ admin: req.admin, action: `更新草稿 ${part}`, targetType: part, ip: clientIp(req) })
  res.json({ ok: true })
})

app.put('/api/admin/slots/:slotKey', requireAuth, requireWrite('popups'), (req, res) => {
  const { slotKey } = req.params
  const items = req.body?.items
  const bundle = getBundle()

  if (slotKey === 'afterEnterApp' || slotKey === 'gridPopAds' || slotKey === 'actPopAds') {
    bundle.popups[slotKey] = items || []
    saveBundle('popups', bundle.popups)
  } else if (slotKey === 'configPopups') {
    bundle.config.popups = items || []
    saveBundle('config', bundle.config)
  } else if (slotKey === 'promo') {
    bundle.config.promo = { ...(bundle.config.promo || {}), ...(req.body || {}) }
    saveBundle('config', bundle.config)
  } else if (slotKey === 'floatBanner') {
    bundle.config.floatBanner = { ...(bundle.config.floatBanner || {}), ...(req.body || {}) }
    saveBundle('config', bundle.config)
  } else if (slotKey === 'featuredAd') {
    bundle.tabs.featured = bundle.tabs.featured || {}
    bundle.tabs.featured.ad = { ...(bundle.tabs.featured.ad || {}), ...(req.body || {}) }
    saveBundle('tabs', bundle.tabs)
  } else if (slotKey === 'mineQuickApps') {
    bundle.tabs.mine = bundle.tabs.mine || {}
    bundle.tabs.mine.quickApps = items || []
    saveBundle('tabs', bundle.tabs)
  } else {
    return res.status(400).json({ error: 'unknown slot' })
  }

  writeLog({ admin: req.admin, action: `编辑广告位 ${slotKey}`, targetType: 'slot', targetId: slotKey, ip: clientIp(req) })
  res.json({ ok: true })
})

app.get('/api/admin/apps', requireAuth, requireRead('apps'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  const page = Math.max(1, Number(req.query.page || 1))
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 30)))
  let apps = getBundle().config.apps || []
  if (q) apps = apps.filter((a) => String(a.name || '').toLowerCase().includes(q) || String(a.url || '').toLowerCase().includes(q))
  const total = apps.length
  const start = (page - 1) * pageSize
  res.json({ apps: apps.slice(start, start + pageSize), total, page, pageSize })
})

app.post('/api/admin/apps', requireAuth, requireWrite('apps'), (req, res) => {
  const appItem = req.body || {}
  const name = String(appItem.name || '').trim()
  if (!name) return res.status(400).json({ error: '请填写应用名称' })
  const bundle = getBundle()
  bundle.config.apps = bundle.config.apps || []
  if (bundle.config.apps.some((a) => a.name === name)) return res.status(409).json({ error: '应用名称已存在' })
  bundle.config.apps.unshift({
    name,
    url: String(appItem.url || ''),
    signUrl: String(appItem.signUrl || ''),
    icon: String(appItem.icon || '/icons/placeholder.png'),
  })
  saveBundle('config', bundle.config)
  writeLog({ admin: req.admin, action: `新增应用 ${name}`, targetType: 'apps', targetId: name, ip: clientIp(req) })
  res.json({ ok: true })
})

app.put('/api/admin/apps/:name', requireAuth, requireWrite('apps'), (req, res) => {
  const oldName = decodeURIComponent(req.params.name)
  const body = req.body || {}
  const bundle = getBundle()
  const idx = (bundle.config.apps || []).findIndex((a) => a.name === oldName)
  if (idx === -1) return res.status(404).json({ error: '应用不存在' })
  const nextName = String(body.name || oldName).trim()
  bundle.config.apps[idx] = {
    ...bundle.config.apps[idx],
    ...body,
    name: nextName,
  }
  saveBundle('config', bundle.config)
  writeLog({ admin: req.admin, action: `编辑应用 ${nextName}`, targetType: 'apps', targetId: nextName, ip: clientIp(req) })
  res.json({ ok: true })
})

app.delete('/api/admin/apps/:name', requireAuth, requireWrite('apps'), (req, res) => {
  const name = decodeURIComponent(req.params.name)
  const bundle = getBundle()
  bundle.config.apps = (bundle.config.apps || []).filter((a) => a.name !== name)
  saveBundle('config', bundle.config)
  writeLog({ admin: req.admin, action: `删除应用 ${name}`, targetType: 'apps', targetId: name, ip: clientIp(req) })
  res.json({ ok: true })
})

app.get('/api/admin/category-apps', requireAuth, requireRead('categories'), (_req, res) => {
  res.json({ categoryApps: getBundle().config.categoryApps || {}, categories: getBundle().config.categories || [] })
})

app.put('/api/admin/category-apps', requireAuth, requireWrite('categories'), (req, res) => {
  const bundle = getBundle()
  bundle.config.categoryApps = req.body?.categoryApps || bundle.config.categoryApps || {}
  if (Array.isArray(req.body?.categories)) bundle.config.categories = req.body.categories
  saveBundle('config', bundle.config)
  writeLog({ admin: req.admin, action: '更新分类应用映射', targetType: 'categoryApps', ip: clientIp(req) })
  res.json({ ok: true })
})

app.post('/api/admin/publish', requireAuth, requireWrite('publish'), (req, res) => {
  const meta = publishAll()
  writeLog({ admin: req.admin, action: '发布站点配置', targetType: 'publish', detail: `v${meta.version}`, ip: clientIp(req) })
  res.json({ ok: true, meta })
})

app.post('/api/admin/discard-draft', requireAuth, requireWrite('publish'), (_req, res) => {
  syncDraftFromLive()
  res.json({ ok: true, bundle: getBundle() })
})

app.post('/api/admin/upload', requireAuth, requireWrite('upload'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到文件' })
  const kind = String(req.query.kind || 'popup')
  const sub = kind === 'icon' ? 'icons' : kind === 'promo' ? 'promo' : 'popups'
  const url = `/uploads/${sub}/${req.file.filename}`
  writeLog({ admin: req.admin, action: `上传素材 ${url}`, targetType: 'upload', targetId: url, ip: clientIp(req) })
  res.json({ ok: true, url })
})

app.get('/api/admin/logs', requireAuth, requireRead('logs'), (req, res) => {
  const limit = Math.min(500, Math.max(10, Number(req.query.limit || 100)))
  const logs = getDb().prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ?').all(limit)
  res.json({ logs })
})

app.get('/api/admin/logs/export', requireAuth, requireRead('logs'), (_req, res) => {
  const logs = getDb().prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 2000').all()
  const header = 'time,admin,action,target_type,target_id,detail,ip\n'
  const rows = logs.map((r) =>
    [r.created_at, r.admin_name, r.action, r.target_type, r.target_id, JSON.stringify(r.detail || ''), r.ip]
      .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(','),
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="operation-logs.csv"')
  res.send('\ufeff' + header + rows.join('\n'))
})

app.get('/api/admin/stats', requireAuth, requireRead('stats'), (_req, res) => {
  const db = getDb()
  const bySlot = db.prepare(`
    SELECT slot, COUNT(*) AS clicks
    FROM ad_events WHERE event_type = 'click'
    GROUP BY slot ORDER BY clicks DESC LIMIT 20
  `).all()
  const daily = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS clicks
    FROM ad_events WHERE event_type = 'click'
    GROUP BY day ORDER BY day DESC LIMIT 14
  `).all()
  res.json({ bySlot, daily })
})

app.post('/api/admin/totp/setup', requireAuth, requireWrite('settings'), async (req, res) => {
  const totp = await loadTotp()
  const secret = totp.generateSecret()
  getDb().prepare('UPDATE admins SET totp_secret = ?, totp_enabled = 0, updated_at = ? WHERE id = ?').run(secret, now(), req.admin.id)
  res.json({
    secret,
    otpauth: totp.otpauthUrl({ secret, issuer: '得污后台', account: req.admin.username }),
  })
})

app.post('/api/admin/totp/enable', requireAuth, requireWrite('settings'), async (req, res) => {
  const code = String(req.body?.code || '').trim()
  const row = getDb().prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id)
  const totp = await loadTotp()
  if (!row?.totp_secret || !totp.verifyTotp(row.totp_secret, code)) {
    return res.status(400).json({ error: '验证码错误' })
  }
  getDb().prepare('UPDATE admins SET totp_enabled = 1, updated_at = ? WHERE id = ?').run(now(), req.admin.id)
  writeLog({ admin: req.admin, action: '启用 2FA', targetType: 'settings', ip: clientIp(req) })
  res.json({ ok: true })
})

app.post('/api/admin/totp/disable', requireAuth, requireWrite('settings'), async (req, res) => {
  const code = String(req.body?.code || '').trim()
  const row = getDb().prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id)
  const totp = await loadTotp()
  if (row?.totp_enabled && !totp.verifyTotp(row.totp_secret, code)) {
    return res.status(400).json({ error: '验证码错误' })
  }
  getDb().prepare('UPDATE admins SET totp_enabled = 0, totp_secret = NULL, updated_at = ? WHERE id = ?').run(now(), req.admin.id)
  writeLog({ admin: req.admin, action: '关闭 2FA', targetType: 'settings', ip: clientIp(req) })
  res.json({ ok: true })
})

app.use(express.static(PUBLIC_DIR))

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err?.message || 'server error' })
})

app.listen(PORT, HOST, () => {
  console.log(`[ads-king-admin] http://${HOST}:${PORT}`)
})
