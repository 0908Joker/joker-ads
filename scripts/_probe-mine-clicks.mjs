import { chromium } from 'playwright'
import fs from 'fs'

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const CLONE = 'https://b12sl5x.cn/#/my'

async function dismiss(page) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page
      .evaluate(() => {
        document
          .querySelectorAll('.van-popup__close-icon,.van-icon-cross,.popup-close,[class*=close]')
          .forEach((el) => {
            try {
              el.click()
            } catch {}
          })
        document.querySelectorAll('.van-overlay,.popup-overlay').forEach((el) => {
          try {
            el.click()
          } catch {}
        })
      })
      .catch(() => {})
    await page.waitForTimeout(100)
  }
}

async function clickExact(page, label) {
  const before = await page.evaluate(() => ({ href: location.href, hash: location.hash }))
  const info = await page.evaluate((lab) => {
    const btns = [...document.querySelectorAll('button,a')]
    const exact = btns.find((b) => (b.innerText || '').replace(/\s+/g, ' ').trim() === lab)
    const soft = btns.find((b) => (b.innerText || '').replace(/\s+/g, ' ').includes(lab))
    const el = exact || soft
    if (!el) {
      return {
        ok: false,
        reason: 'not found',
        candidates: btns.slice(0, 40).map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
      }
    }
    el.click()
    return {
      ok: true,
      tag: el.tagName,
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      className: String(el.className || '').slice(0, 80),
    }
  }, label)
  await page.waitForTimeout(1600)
  const after = await page.evaluate(() => ({
    href: location.href,
    hash: location.hash,
    body: (document.body.innerText || '').slice(0, 240),
  }))
  return {
    label,
    info,
    before,
    after,
    navigated: before.href !== after.href,
  }
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const pagesOpened = []
ctx.on('page', (p) => pagesOpened.push(p.url()))

await page.goto(CLONE, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(2500)
await dismiss(page)
await page.waitForTimeout(500)

const structure = await page.evaluate(() => {
  const t = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const body = document.body.innerText || ''
  const version = (body.match(/v\d+\.\d+\.\d+/) || [])[0] || ''
  const id = (body.match(/ID[:：]?\s*(\d+)/) || [])[1] || ''
  const tools = t(document.querySelector('.profile__tools'))
  const avatar = document.querySelector('.avatar')
  const avatarInfo = avatar
    ? {
        text: t(avatar),
        w: Math.round(avatar.getBoundingClientRect().width),
        hasImg: !!avatar.querySelector('img'),
      }
    : null
  const quickRows = [...document.querySelectorAll('.quick-row')].map((row) =>
    [...row.querySelectorAll('.quick-app span')].map(t).filter(Boolean),
  )
  const rec = [...document.querySelectorAll('.recommend .quick-app span')].map(t)
  const services = [...document.querySelectorAll('.service')].map(t)
  const emptyHints = ['暂无推荐应用', '前往应用中心', '暂无'].filter((s) => body.includes(s))
  const deadShells = [...document.querySelectorAll('button')].map((b) => {
    const label = t(b).slice(0, 40)
    const hasVue = !!(b.__vueParentComponent || b._vei)
    return { label, hasVue }
  })
  return {
    version,
    id,
    tools,
    avatarInfo,
    quickRows,
    rec,
    services,
    emptyHints,
    deadShells: deadShells.filter((d) =>
      /开通|充值|绑定|前往|身份|AI|分享邀请|邮箱|订单|客服|版本|消息|商务|邀请码|福利|帮助|群|原创|浏览|下载|视频/.test(
        d.label,
      ),
    ),
  }
})

const labels = [
  '立即开通',
  '立即充值',
  '注册/绑定有礼 1日VIP 去绑定',
  '立即前往',
  '身份卡',
  'AI创造中心',
  '分享邀请',
  '更多',
  '下载管理',
  '我的视频',
  '绑定邮箱',
  '浏览记录',
  '邀请码',
  '客服中心',
  '版本检测',
  '消息',
  '商务合作',
  '订单记录',
]

const clicks = []
for (const lab of labels) {
  await page.goto(CLONE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1000)
  await dismiss(page)
  clicks.push(await clickExact(page, lab))
}

await browser.close()
const out = { at: new Date().toISOString(), structure, clicks, pagesOpened }
fs.mkdirSync('crawled', { recursive: true })
fs.writeFileSync('crawled/audit-mine-clicks.json', JSON.stringify(out, null, 2))
console.log(
  JSON.stringify(
    {
      structure: {
        version: structure.version,
        id: structure.id,
        tools: structure.tools,
        avatar: structure.avatarInfo,
        quick: structure.quickRows,
        rec: structure.rec,
        svcCount: structure.services.length,
        emptyHints: structure.emptyHints,
      },
      dead: structure.deadShells.map((d) => ({ l: d.label, vue: d.hasVue })),
      clicks: clicks.map((c) => ({
        l: c.label,
        ok: c.info.ok,
        nav: c.navigated,
        hash: c.after.hash,
        text: c.info.text,
      })),
      pagesOpened,
    },
    null,
    2,
  ),
)
