// Serve the actual production bundle with isolated API fixtures for browser QA.
// No customer claims or ad clicks are forwarded to production.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2] || 'crawled/_production-nav')
const configPath = path.resolve(process.argv[3] || '../joker-ads-implementation-evidence-20260929/live-config.json')
const tabsPath = path.resolve(process.argv[4] || '../joker-ads-implementation-evidence-20260929/live-tabs.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const tabs = JSON.parse(fs.readFileSync(tabsPath, 'utf8'))
const report = { normal: [], legacy: [], failure: [] }
const icons = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="16" fill="#18303a"/></svg>'

for (const [mode, port] of [['normal', 4317], ['legacy', 4318], ['failure', 4319]]) {
  http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    const send = (type, data, status = 200) => {
      res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'none'",
      })
      res.end(data)
    }
    const json = (data, status = 200) => send('application/json', JSON.stringify(data), status)
    if (url.pathname === '/__qa/report') return json(report)
    if (url.pathname === '/api/public/customers/claim') {
      let body = ''
      for await (const chunk of req) body += chunk
      const request = JSON.parse(body || '{}')
      report[mode].push({ inviteCode: request.inviteCode || '', hasPreviousCardToken: Boolean(request.cardToken) })
      return json({ customerId: 'qa-customer', cardNo: '9000000000001', inviteCode: '9000000000001',
        invitedBy: request.inviteCode || '', inviteCount: 7, isNew: !request.cardToken, token: 'qa-only-card-token' })
    }
    if (url.pathname === '/data/config.json') {
      if (mode === 'failure') return json({ error: 'intentional QA failure' }, 503)
      const value = structuredClone(config)
      if (mode === 'legacy') value.tabbar = [{ id: 'invite', label: '得污', icon: 'home' }, ...value.tabbar, { id: 'home', label: '旧首页', icon: 'home' }]
      return json(value)
    }
    if (url.pathname === '/data/tabs.json') return json(tabs)
    if (url.pathname === '/data/popups.json') return json({ afterEnterApp: [{ name: 'QA empty media', coverUrl: '/qa-unavailable.img' }], gridPopAds: [] })
    if (url.pathname.startsWith('/data/')) return json({})
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/pay-bff')) return json({ data: [], items: [], list: [] })
    if (url.pathname === '/') return send('text/html; charset=utf-8', fs.readFileSync(path.join(root, 'release/index.html')))
    if (url.pathname.startsWith('/assets/')) {
      const name = path.basename(url.pathname)
      const releaseFile = path.join(root, 'release/assets', name)
      const baselineFile = path.join(root, 'baseline/assets', name)
      const file = fs.existsSync(releaseFile) ? releaseFile : baselineFile
      if (fs.existsSync(file)) return send(name.endsWith('.css') ? 'text/css' : 'text/javascript', fs.readFileSync(file))
      return send('text/plain', 'Not found', 404)
    }
    if (/\.(png|jpe?g|gif|svg|webp)$/i.test(url.pathname)) return send('image/svg+xml', icons)
    return send('text/plain', 'Not found', 404)
  }).listen(port, '127.0.0.1', () => console.log(`${mode}: http://127.0.0.1:${port}/`))
}
