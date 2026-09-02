import { chromium } from 'playwright'
import fs from 'fs'

const CLONE = 'https://b12sl5x.cn'
const ORIGIN = 'https://fbi.xdx794.com'
const out = { at: new Date().toISOString(), clone: CLONE, origin: ORIGIN }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
})

async function dismiss(page) {
  for (let i = 0; i < 8; i++) {
    const closed = await page
      .evaluate(() => {
        const sels = [
          '.popup-close',
          '.ad-popup__close',
          '.van-popup__close-icon',
          '[class*="close"]',
          '[class*="Close"]',
        ]
        for (const s of sels) {
          const el = document.querySelector(s)
          if (el && el.offsetParent !== null) {
            el.click()
            return true
          }
        }
        return false
      })
      .catch(() => false)
    if (!closed) break
    await page.waitForTimeout(350)
  }
}

async function probe(label, url) {
  const page = await ctx.newPage()
  const res = { label, url, ok: false }
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    res.status = r?.status()
    await page.waitForTimeout(3000)
    await dismiss(page)
    await page.waitForTimeout(600)
    res.hash = await page.evaluate(() => location.hash)
    res.title = await page.title()
    res.bodyPreview = (
      await page.evaluate(() => document.body?.innerText?.slice(0, 280) || '')
    ).replace(/\s+/g, ' ')
    res.blocked = /禁止登陆|禁止登录|ip已经|此ip/i.test(res.bodyPreview)
    res.tabbar = await page.evaluate(() =>
      [...document.querySelectorAll('.tabbar-item, .van-tabbar-item')]
        .map((e) => e.innerText.trim().split('\n')[0])
        .filter(Boolean)
        .slice(0, 10),
    )
    res.ok = true
  } catch (e) {
    res.error = e.message
  }
  await page.close()
  return res
}

const routes = [
  '#/appcenter',
  '#/videosPage',
  '#/short',
  '#/darkWeb/darkSecond',
  '#/circle',
  '#/vipPage',
  '#/my',
]
out.originRoutes = []
out.cloneRoutes = []
for (const h of routes) {
  out.originRoutes.push(await probe('origin' + h, ORIGIN + '/' + h))
  out.cloneRoutes.push(await probe('clone' + h, CLONE + '/' + h))
}

{
  const page = await ctx.newPage()
  await page.goto(CLONE + '/#/videosPage', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  })
  await page.waitForTimeout(4000)
  await dismiss(page)
  const want = ['最新', '推荐', '夏日限定', '18岁', '制服', '探花']
  const perTab = {}
  for (const name of want) {
    await page.evaluate((n) => {
      const el = [...document.querySelectorAll('div,span,a,button')].find(
        (e) =>
          e.innerText?.trim() === n && e.children.length === 0 && e.offsetParent,
      )
      if (el) el.click()
    }, name)
    await page.waitForTimeout(2200)
    perTab[name] = await page.evaluate(() => {
      const cards = [
        ...document.querySelectorAll(
          '.video-card, .feed-item, [class*="video-card"]',
        ),
      ]
      const titles = cards
        .map(
          (c) =>
            (c.innerText || '').split('\n').find((l) => l && l.length > 6) || '',
        )
        .filter(Boolean)
        .slice(0, 5)
      return { count: cards.length, titles }
    })
  }
  const sigs = Object.values(perTab).map((v) => (v.titles || []).join('|'))
  const unique = new Set(sigs.filter(Boolean)).size
  out.featuredDistinct = {
    perTab,
    uniqueSignatures: unique,
    allSame: unique <= 1 && sigs.some(Boolean),
  }
  await page.close()
}

{
  const page = await ctx.newPage()
  await page.goto(CLONE + '/#/my', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(3500)
  await dismiss(page)
  const before = await page.evaluate(() => location.hash)
  const clicks = {}
  for (const label of ['开通会员', '钻石充值', '分享邀请', 'VIP', '充值']) {
    const clicked = await page.evaluate((lab) => {
      const el = [...document.querySelectorAll('button, a, div, span')].find(
        (e) => (e.innerText || '').trim().includes(lab) && e.offsetParent,
      )
      if (!el) return false
      el.click()
      return true
    }, label)
    await page.waitForTimeout(900)
    const after = await page.evaluate(() => location.hash)
    clicks[label] = { clicked, before, after, navigated: after !== before }
    if (after !== before) {
      await page.goto(CLONE + '/#/my', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      await dismiss(page)
    }
  }
  out.mineClicks = clicks
  await page.close()
}

await browser.close()
fs.writeFileSync(
  'crawled/_master-spotcheck-2026-08-26.json',
  JSON.stringify(out, null, 2),
)
console.log(
  JSON.stringify(
    {
      originBlocked: out.originRoutes.map((r) => ({
        url: r.url,
        hash: r.hash,
        blocked: r.blocked,
        preview: r.bodyPreview?.slice(0, 90),
      })),
      cloneOk: out.cloneRoutes.map((r) => ({
        want: r.url.split('#')[1],
        got: r.hash,
        tabs: r.tabbar,
        preview: r.bodyPreview?.slice(0, 60),
      })),
      featuredAllSame: out.featuredDistinct.allSame,
      featuredUnique: out.featuredDistinct.uniqueSignatures,
      sampleTitles: Object.fromEntries(
        Object.entries(out.featuredDistinct.perTab).map(([k, v]) => [
          k,
          v.titles?.[0] || null,
        ]),
      ),
      mineClicks: out.mineClicks,
    },
    null,
    2,
  ),
)
