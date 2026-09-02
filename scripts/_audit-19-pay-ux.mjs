import { chromium } from 'playwright'
import fs from 'fs'

const ORIGIN = 'https://fbi.xdx794.com'
const CLONE = 'https://b12sl5x.cn'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()

const jsUrls = new Set()
page.on('response', (res) => {
  const u = res.url()
  if (/\.js(\?|$)/.test(u)) jsUrls.add(u)
})

await page
  .goto(ORIGIN + '/#/recharge/goldRecharge', { waitUntil: 'networkidle', timeout: 60000 })
  .catch(() => {})
await page.waitForTimeout(1500)

const out = { jsUrls: [...jsUrls], routeHits: [], patternHits: [], clone: {} }
const bundles = []
for (const u of [...jsUrls].slice(0, 30)) {
  try {
    const r = await page.request.get(u, { timeout: 30000 })
    if (!r.ok()) continue
    const t = await r.text()
    if (t.length < 8000) continue
    bundles.push({ u, len: t.length, t })
  } catch {}
}

const needles = [
  'vipRecharge',
  'goldRecharge',
  'path:"/recharge',
  "path:'/recharge",
  'path:"/recharge/',
  "path:'/recharge/",
  'type=vip',
  'type=gold',
  'exchangeCenter',
  'rechargeRecord',
  'buyRecord',
  'aiForVIPCard',
  'dailyCheckIn',
  '/my/share',
  'create_order',
  'createOrder',
]

for (const b of bundles) {
  for (const n of needles) {
    let from = 0
    let guard = 0
    while (guard++ < 4) {
      const idx = b.t.indexOf(n, from)
      if (idx < 0) break
      out.routeHits.push({
        needle: n,
        bundle: b.u,
        snippet: b.t.slice(Math.max(0, idx - 160), idx + 280),
      })
      from = idx + n.length
    }
  }
}

const hitMap = new Map()
const reList = [
  /\/recharge[^"'\\\s]{0,40}/g,
  /type=(?:vip|gold|diamond)/g,
  /(?:vipRecharge|goldRecharge|exchangeCenter|buyRecord|rechargeRecord|conDetail)/g,
  /activityPage\/[A-Za-z0-9_-]+/g,
  /\/my\/[A-Za-z0-9_-]+/g,
  /aiGirlFriend|aiHome|aiTools|aiForVIPCard/g,
]
for (const b of bundles) {
  for (const re of reList) {
    const m = b.t.match(re) || []
    for (const x of m) hitMap.set(x, (hitMap.get(x) || 0) + 1)
  }
}
out.patternHits = [...hitMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)
out.bundles = bundles.map((b) => ({ u: b.u, len: b.len }))

async function bodySample() {
  return (await page.locator('body').innerText().catch(() => ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

await page.goto(CLONE + '/#/my', { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(2000)
out.clone.before = { hash: await page.evaluate(() => location.hash), sample: await bodySample() }

async function clickClone(label, text) {
  await page.goto(CLONE + '/#/my', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1000)
  const loc = page.getByText(text, { exact: false }).first()
  const vis = await loc.isVisible().catch(() => false)
  if (!vis) {
    out.clone[label] = { ok: false, reason: 'not_visible' }
    return
  }
  const before = await page.evaluate(() => location.hash)
  await loc.click({ force: true }).catch(() => {})
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => location.hash)
  out.clone[label] = {
    ok: true,
    before,
    after,
    navigated: before !== after,
    sample: await bodySample(),
  }
}

for (const [label, text] of [
  ['立即开通', '立即开通'],
  ['立即充值', '立即充值'],
  ['订单记录', '订单记录'],
  ['身份卡', '身份卡'],
  ['AI创造中心', 'AI创造中心'],
  ['分享邀请', '分享邀请'],
  ['每日任务', '立即前往'],
  ['去绑定', '去绑定'],
  ['我的福利', '我的福利'],
]) {
  await clickClone(label, text)
}

await page.goto(CLONE + '/#/vipPage', { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(1200)
const beforeA = await page.evaluate(() => location.hash)
const animeBtn = page.getByText('开通会员', { exact: false }).first()
if (await animeBtn.isVisible().catch(() => false)) {
  await animeBtn.click({ force: true }).catch(() => {})
  await page.waitForTimeout(800)
  const afterA = await page.evaluate(() => location.hash)
  out.clone.anime开通会员 = {
    before: beforeA,
    after: afterA,
    navigated: beforeA !== afterA,
    sample: await bodySample(),
  }
}

// Clone missing routes
for (const r of [
  '/#/recharge',
  '/#/recharge?type=vip',
  '/#/recharge/goldRecharge',
  '/#/recharge/vipRecharge',
  '/#/recharge/rechargeRecord',
  '/#/activityPage/dailyCheckIn',
  '/#/message',
  '/#/my/share',
]) {
  await page.goto(CLONE + r, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(700)
  out.clone['route:' + r] = {
    hash: await page.evaluate(() => location.hash),
    sample: await bodySample(),
  }
}

fs.writeFileSync('crawled/_audit-19-pay-probe.json', JSON.stringify(out, null, 2))
console.log(
  JSON.stringify(
    {
      bundles: out.bundles,
      patternTop: out.patternHits.slice(0, 50),
      snippets: out.routeHits.slice(0, 12).map((r) => ({
        needle: r.needle,
        u: r.bundle.slice(-60),
        s: r.snippet.replace(/\s+/g, ' ').slice(0, 240),
      })),
      cloneKeys: Object.keys(out.clone),
      clone: out.clone,
    },
    null,
    2,
  ),
)
await browser.close()
