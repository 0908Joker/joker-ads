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
data.tabs.mine.quickApps.push(...Array.from({ length: 7 }, (_, i) => ({ name: '快捷测试' + (i + 2), icon: '/icon.png', url: 'https://example.invalid/quick' + (i + 2) })))
const calls = [], errors = [], checks = [], adEvents = []
let scenario = 'normal'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()); calls.push(url.pathname)
    if (url.pathname === '/api/public/ad-click') adEvents.push(req.postDataJSON())
    if (req.isNavigationRequest() && url.hostname !== 'b12sl5x.cn') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated external target</title><p>Ad target reached</p>' })
    if (url.pathname === '/bundle.js') return route.fulfill({ contentType: 'application/javascript', body: bundle })
    if (url.pathname.endsWith('/hls-DTZVvFfy.js')) {
      const dependency = await fetch('https://b12sl5x.cn/assets/hls-DTZVvFfy.js')
      assert.equal(dependency.status, 200)
      return route.fulfill({ contentType: 'text/javascript', body: await dependency.text() })
    }
    if (url.pathname === '/style.css') return route.fulfill({ contentType: 'text/css', body: process.env.AUDIT_CSS ? fs.readFileSync(process.env.AUDIT_CSS, 'utf8') : 'html{font-size:48px}body{margin:0;color:white;background:#080d12;font-family:sans-serif}button{font:inherit}' })
    if (url.pathname === '/data/site-bundle.json') {
      if (scenario === 'hang') return
      if (scenario === 'ads') return route.fulfill({ json: {
        ...data, apiSession: {},
        config: { ...config, promo: { text: '促销测试', url: 'https://example.invalid/promo' }, floatBanner: { title: '悬浮测试', url: 'https://example.invalid/float' } },
        popups: { afterEnterApp: [{ name: '进站测试', image: '/icon.png', url: 'https://example.invalid/popup' }], gridPopAds: [{ name: '网格测试', image: '/icon.png', url: 'https://example.invalid/grid' }], actPopAds: [] }
      } })
      if (scenario === 'empty') return route.fulfill({ json: { ...data, apiSession: {}, config: { ...config, apps: [], promo: {}, floatBanner: {} }, tabs: { mine: { quickApps: [] }, featured: { subTabs: [], ad: {} } } } })
      return route.fulfill({ json: { ...data, apiSession: {} } })
    }
    const match = /^\/data\/([\w-]+)\.json$/.exec(url.pathname)
    if (match) return route.fulfill({ json: data[match[1]] || {} })
    if (url.pathname === '/api/public/customers/claim') {
      if (scenario === 'hang') return
      return route.fulfill({ json: { ok: true, isNew: false, customerId: 'DW-FIXTURE', cardNo: 'CARD-FIXTURE', inviteCode: '1234567890123', inviteCount: 0 } })
    }
    if (url.pathname === '/hold.webm') return
    if (url.pathname === '/hung-cover.ceb') return
    if (scenario === 'short-cover-hang' && /^\/api-proxy\/videos\/short/.test(url.pathname)) return route.fulfill({ json: { sid: 'fixture', data: { videoInfo: [
      { url: '/fixture.webm', video: { id: 'SHORT-A', name: '短视频 QA 正常封面', coverURL: 'https://b12sl5x.cn/icon.png' } },
      { url: '/fixture.webm', video: { id: 'SHORT-B', name: '短视频 QA 挂起封面', coverURL: 'https://b12sl5x.cn/hung-cover.ceb' } },
    ] } } })
    if (url.pathname === '/fixture.webm' && process.env.AUDIT_VIDEO) return route.fulfill({ contentType: 'video/webm', body: fs.readFileSync(process.env.AUDIT_VIDEO) })
    if (/^\/api-proxy\/videos\/QA-/.test(url.pathname)) {
      const id = url.pathname.split('/').at(-1)
      return route.fulfill({ json: { data: { url: id === 'QA-A' ? '/hold.webm' : '/fixture.webm', previewUrl: '/must-not-play.webm', video: { id, name: '隔离播放测试 ' + id, time: 2 }, otherVideos: [] }, sid: 'fixture' } })
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
    assert.deepEqual(await page.locator('.quick-grid--6 .quick-app span').allTextContents(), data.tabs.mine.quickApps.map(app => app.name), 'all quick apps retain backend order beyond the first row')
    await page.goto('https://b12sl5x.cn/#/videosPage')
    await page.getByText('后台精选测试', { exact: true }).waitFor()
    checks.push('configured quick apps and featured ad rendered')
  }
  assert.deepEqual(errors, [], 'No application runtime errors')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('https://b12sl5x.cn/#/appcenter')
  await page.getByText('审核示例应用', { exact: true }).first().waitFor()
  checks.push('desktop app center nonblank with fixture app')
  assert.deepEqual(await page.locator('.tabbar-item__text').allTextContents(), ['应用', '精选', '抖阴', '我的'])
  for (const label of ['精选', '抖阴', '我的', '应用']) {
    await page.locator('.tabbar-item').filter({ hasText: label }).click()
    assert.equal((await page.locator('.tabbar-item.is-active').innerText()).trim(), label)
  }
  await page.goto('https://b12sl5x.cn/#/my/shareApp')
  assert.equal(await page.locator('.link__url').innerText(), 'http://okqpkdj.cn/?inviteCode=1234567890123')
  assert.equal(await page.locator('.invite__code').innerText(), '1234567890123')
  checks.push('four bottom tabs clickable; local invite code and landing URL retained')
  await page.goto('https://b12sl5x.cn/#/appcenter')
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
    assert.ok((await page.getByRole('status').innerText()).includes('配置加载失败，请重试'))
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
  if (manifest.stage >= 3) {
    scenario = 'ads'
    await page.addInitScript(() => {
      sessionStorage.clear()
      window.__nativeMessages = []
      window.DewuNative = { postMessage: text => window.__nativeMessages.push(JSON.parse(text)) }
    })
    await page.addInitScript(fs.readFileSync('android/app/src/main/assets/native-bridge.js', 'utf8'))
    await page.goto('https://b12sl5x.cn/')
    async function clickAd(selector, slot) {
      const before = adEvents.length
      await page.locator(selector).click()
      for (let i = 0; i < 30 && adEvents.length === before; i++) await new Promise(resolve => setTimeout(resolve, 20))
      assert.equal(adEvents.length, before + 1, slot + ' exactly one local event')
      assert.equal(adEvents.at(-1).slot, slot)
      for (const other of context.pages()) if (other !== page) await other.close()
    }
    await page.locator('.popup-card').waitFor()
    await clickAd('.popup-card', 'afterEnterApp')
    await page.locator('.popup-close').click()
    await page.locator('.grid-ad').waitFor()
    await clickAd('.grid-ad', 'gridPopAds')
    await page.locator('.popup-close').click()
    await clickAd('.promo-banner', 'promo')
    await clickAd('.float-banner__btn', 'floatBanner')
    await clickAd('.app-card', 'appCenter')
    await page.goto('https://b12sl5x.cn/#/my')
    await clickAd('.quick-app:has-text("后台快捷测试")', 'mineQuickApps')
    await clickAd('.quick-app:has-text("审核示例应用")', 'mineRecommendations')
    await page.goto('https://b12sl5x.cn/#/videosPage')
    await clickAd('.featured-ad', 'featuredAd')
    checks.push('all eight advertisement entry types send exactly one local click with fixed nonempty slot')
    await page.goto('https://b12sl5x.cn/#/my')
    await page.getByRole('button', { name: '复制ID', exact: true }).click()
    await page.waitForFunction(() => window.__nativeMessages.some(message => message.type === 'copy'))
    assert.equal(await page.getByText('ID 已复制', { exact: true }).count(), 0, 'no optimistic copy toast')
    await page.evaluate(() => { const message = window.__nativeMessages.at(-1); DewuNative.onmessage({ data: JSON.stringify({ id: message.id, status: 'error', error: 'TEXT_TOO_LONG' }) }) })
    await page.getByText('复制失败，请手动选择', { exact: true }).waitFor()
    await page.getByRole('button', { name: '身份卡', exact: false }).click()
    await page.getByRole('button', { name: '截图保存', exact: true }).click()
    await page.waitForFunction(() => window.__nativeMessages.some(message => message.type === 'saveImage'))
    assert.equal(await page.getByText('身份卡已保存', { exact: true }).count(), 0)
    await page.evaluate(() => { const message = window.__nativeMessages.at(-1); DewuNative.onmessage({ data: JSON.stringify({ id: message.id, status: 'cancelled' }) }) })
    await page.getByText('已取消保存', { exact: true }).waitFor()
    checks.push('actual frontend plus actual Android JS bridge: copy rejection is failure; save waits; cancel is not success')
    if (process.env.AUDIT_VIDEO) {
      await page.goto('https://b12sl5x.cn/#/play/QA-A')
      await page.waitForFunction(() => document.querySelector('video')?.getAttribute('src') === '/hold.webm')
      await page.goto('https://b12sl5x.cn/#/play/QA-B')
      await page.waitForFunction(() => { const video = document.querySelector('video'); return video && video.readyState >= 2 && video.currentTime > 0 }, { timeout: 10000 })
      assert.ok((await page.locator('h1').innerText()).includes('QA-B'))
      assert.equal(await page.locator('.play__status').count(), 0, 'successful playback clears loading state')
      assert.equal(calls.includes('/must-not-play.webm'), false)
      if (screenshots) await page.screenshot({ path: path.join(screenshots, 'batch3-video-playing.png') })
      await page.goto('https://b12sl5x.cn/#/appcenter')
      assert.equal(await page.locator('video.play__video').count(), 0)
      checks.push('actual browser decodes and plays isolated WebM after cancelling hung A; no A fallback; leaving destroys player')
    }
  }
  if (manifest.stage >= 4) {
    scenario = 'short-cover-hang'
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('https://b12sl5x.cn/')
    const started = Date.now()
    await page.locator('.tabbar-item').filter({ hasText: '抖阴' }).click()
    await page.getByText('短视频 QA 挂起封面', { exact: true }).waitFor({ timeout: 2500 }).catch(async error => {
      console.log(JSON.stringify({ shortRequests: calls.slice(-20), pageErrors: errors, shortText: (await page.locator('body').innerText()).slice(0,900) }))
      throw error
    })
    assert.equal(await page.locator('.short-slide').count(), 2)
    assert.ok(Date.now() - started < 3000, 'hung cover does not block list rendering')
    await page.waitForFunction(() => document.querySelector('.short-slide video')?.readyState >= 2)
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'batch4-independent-covers-mobile.png') })
    await page.locator('.tabbar-item').filter({ hasText: '我的' }).click()
    assert.equal(await page.locator('.short-slide video').count(), 0)
    checks.push('short feed renders both items while one cover hangs; first video decodes; leaving removes videos')
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ stage: manifest.stage, frontendSha256: manifest.frontendSha256, checks, pageErrors: errors.length, productionWrites: 0, screenshots }, null, 2))
} finally { await browser.close() }
