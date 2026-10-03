// Real shipped bundle, isolated HTTP fixtures: never claims a production identity.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const out = path.resolve(process.env.AUDIT_BUNDLE_OUT || 'dist/audit-release')
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')))
const bundle = fs.readFileSync(path.join(out, manifest.frontend), 'utf8')
const screenshots = process.env.AUDIT_REPORT_DIR
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64')
const config = { categories: ['官方推荐'], modes: [{ id: 'recommend', label: '站长推荐' }], apps: [{ name: '审核示例应用', url: 'https://example.invalid/ad', icon: '/icon.png' }], categoryApps: { byCategory: { '官方推荐': ['审核示例应用'] }, modes: { '站长推荐': ['审核示例应用'] }, modesByCategory: {} }, popups: [], promo: {}, floatBanner: {} }
const data = { config, popups: { afterEnterApp: [], gridPopAds: [], actPopAds: [] }, tabs: { mine: { quickApps: [{ name: '后台快捷测试', icon: '/icon.png', url: 'https://example.invalid/quick' }] }, featured: { subTabs: ['推荐'], ad: { name: '后台精选测试', url: 'https://example.invalid/featured', viewers: '测试' } } }, meta: { version: 17 }, 'api-session': {} }
const calls = [], errors = [], checks = []
let scenario = 'normal'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()); calls.push(url.pathname)
    if (url.pathname === '/bundle.js') return route.fulfill({ contentType: 'application/javascript', body: bundle })
    if (url.pathname === '/style.css') return route.fulfill({ contentType: 'text/css', body: process.env.AUDIT_CSS ? fs.readFileSync(process.env.AUDIT_CSS, 'utf8') : 'html{font-size:48px}body{margin:0;color:white;background:#080d12;font-family:sans-serif}button{font:inherit}' })
    if (url.pathname === '/data/site-bundle.json') {
      if (scenario === 'hang') return
      if (scenario === 'empty') return route.fulfill({ json: { ...data, apiSession: {}, config: { ...config, apps: [], promo: {}, floatBanner: {} }, tabs: { mine: { quickApps: [] }, featured: { subTabs: [], ad: {} } } } })
      return route.fulfill({ json: { ...data, apiSession: {} } })
    }
    const match = /^\/data\/([\w-]+)\.json$/.exec(url.pathname)
    if (match) return route.fulfill({ json: data[match[1]] || {} })
    if (url.pathname === '/api/public/customers/claim') {
      if (scenario === 'hang') return
      return route.fulfill({ json: { ok: true, isNew: false, customerId: 'DW-FIXTURE', cardNo: 'CARD-FIXTURE', inviteCode: '1234567890123', inviteCount: 0 } })
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api-proxy/')) return route.fulfill({ json: { ok: true, code: 200, message: 'success', data: {}, sid: 'fixture' } })
    if (/\.(png|webp|gif|jpg|jpeg|svg)$/.test(url.pathname)) return route.fulfill({ contentType: 'image/png', body: png })
    if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'application/javascript', body: 'export default [];' })
    if (req.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>joker-ads isolated QA</title><link rel="stylesheet" href="/style.css"><style>html{font-size:48px}</style><script>document.documentElement.dataset.shell=innerWidth>460?"desktop":"fluid"</script></head><body><div id="app"></div><script type="module" src="/bundle.js"></script></body></html>' })
    return route.fulfill({ status: 204, body: '' })
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('https://b12sl5x.cn/#/recharge')
  await page.getByRole('button', { name: '新支付已暂停' }).waitFor()
  assert.ok(await page.getByRole('button', { name: '新支付已暂停' }).isDisabled())
  assert.ok((await page.locator('body').innerText()).includes('已有订单仍可查询'))
  await page.getByRole('button', { name: '钻石充值', exact: true }).click()
  assert.equal(await page.locator('h1').innerText(), '钻石充值')
  checks.push('recharge disabled; existing-query notice; tab interaction')
  if (screenshots) { fs.mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: path.join(screenshots, `batch${manifest.stage}-payment-mobile.png`) }) }
  await page.goto('https://b12sl5x.cn/#/my')
  await page.getByText('DW-FIXTURE', { exact: false }).waitFor()
  assert.ok((await page.locator('body').innerText()).includes('客户账户尚未接入'))
  await page.getByRole('button', { name: '身份卡', exact: false }).click()
  assert.ok((await page.locator('body').innerText()).includes('CARD-FIXTURE'))
  checks.push('local identity and identity-card dialog retained')
  await page.goto('https://b12sl5x.cn/#/activityPage/dailyCheckIn')
  await page.getByRole('button', { name: '本地签到奖励尚未接入' }).waitFor()
  assert.ok(await page.getByRole('button', { name: '本地签到奖励尚未接入' }).isDisabled())
  assert.equal(calls.some(p => ['/users/info', '/users/signin', '/users/actionStats'].some(s => p.endsWith(s))), false)
  assert.equal(calls.includes('/pay-bff/create'), false)
  checks.push('no shared user calls; no payment-create calls')
  if (manifest.stage >= 2) {
    await page.goto('https://b12sl5x.cn/#/my')
    await page.getByText('后台快捷测试', { exact: true }).waitFor()
    await page.goto('https://b12sl5x.cn/#/videosPage')
    await page.getByText('后台精选测试', { exact: true }).waitFor()
    checks.push('configured quick apps and featured ad rendered')
  }
  assert.deepEqual(errors, [], 'No application runtime errors')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('https://b12sl5x.cn/#/appcenter')
  await page.getByText('审核示例应用', { exact: true }).first().waitFor()
  checks.push('desktop app center nonblank with fixture app')
  if (screenshots) await page.screenshot({ path: path.join(screenshots, `batch${manifest.stage}-apps-desktop.png`) })
  if (manifest.stage >= 2) {
    scenario = 'empty'
    await page.goto('https://b12sl5x.cn/')
    await page.goto('https://b12sl5x.cn/#/my')
    await page.getByText('DW-FIXTURE', { exact: false }).waitFor()
    assert.equal(await page.getByText('后台快捷测试', { exact: true }).count(), 0)
    await page.goto('https://b12sl5x.cn/#/videosPage')
    assert.equal(await page.locator('.featured-ad').count(), 0)
    scenario = 'hang'
    const callStart = calls.length
    const started = Date.now()
    await page.goto('https://b12sl5x.cn/')
    await page.getByText('加载中…', { exact: true }).waitFor({ timeout: 2000 })
    await page.getByRole('status').waitFor({ timeout: 6500 })
    assert.ok(Date.now() - started < 6000, 'hung requests degrade after five seconds')
    await page.getByText('该分类暂无应用', { exact: true }).waitFor()
    for (const selector of ['.promo-banner', '.float-banner', '.popup-overlay', '.app-card']) assert.equal(await page.locator(selector).count(), 0, selector + ' has no stale ad')
    if (screenshots) await page.screenshot({ path: path.join(screenshots, `batch${manifest.stage}-timeout.png`) })
    scenario = 'normal'
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.getByText('审核示例应用', { exact: true }).first().waitFor()
    assert.equal(calls.slice(callStart).filter(p => p === '/api/public/customers/claim').length, 1, 'config retry cannot loop identity claims')
    assert.equal(calls.slice(callStart).filter(p => /^\/data\/(config|tabs|popups|meta)\.json$/.test(p)).length, 0, 'one complete bundle instead of mixed versions')
    checks.push('clear hides configured slots; five-second failure with operable retry; no old ads; no identity retry loop')
    const adminContext = await browser.newContext()
    await adminContext.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/admin/me') return route.fulfill({ json: { user: { username: 'fixture', role: 'readonly', mustChangePassword: false } } })
      if (url.pathname === '/api/admin/site-config') return route.fulfill({ json: data })
      if (url.pathname === '/api/admin/dashboard') return route.fulfill({ json: { stats: {}, logs: [] } })
      if (url.pathname === '/api/admin/apps') return route.fulfill({ json: { apps: config.apps, page: 1, pageSize: 30, total: 1 } })
      for (const file of ['admin.js', 'admin.css']) if (url.pathname === '/' + file) return route.fulfill({ contentType: file.endsWith('js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(path.resolve('admin/public', file), 'utf8') })
      if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.resolve('admin/public/index.html'), 'utf8') })
      return route.fulfill({ status: 204, body: '' })
    })
    const adminPage = await adminContext.newPage()
    adminPage.on('pageerror', error => errors.push(error.message))
    await adminPage.goto('https://admin.b12sl5x.cn/')
    await adminPage.locator('[data-page="apps"]').click()
    await adminPage.getByText('审核示例应用', { exact: true }).waitFor()
    assert.equal(await adminPage.locator('#add-app').count(), 0)
    await adminPage.getByRole('button', { name: '搜索', exact: true }).click()
    await adminPage.getByText('审核示例应用', { exact: true }).waitFor()
    checks.push('real readonly admin page loads and searches with no write controls or JS error')
    if (screenshots) await adminPage.screenshot({ path: path.join(screenshots, `batch${manifest.stage}-readonly-admin.png`) })
    await adminContext.close()
  }
  assert.deepEqual(errors, [], 'No errors after failure/retry and readonly navigation')
  console.log(JSON.stringify({ stage: manifest.stage, frontendSha256: manifest.frontendSha256, checks, pageErrors: errors.length, productionWrites: 0, screenshots }, null, 2))
} finally { await browser.close() }
