import { chromium } from 'playwright'
import fs from 'fs'

const ORIGIN = 'https://fbi.xdx794.com'
const CLONE = 'https://b12sl5x.cn'
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const EXPECT = {
  应用: '#/appcenter',
  精选: '#/videosPage',
  抖阴: '#/short',
  暗网: '#/darkWeb/darkSecond',
  圈子: '#/circle',
  二次元: '#/vipPage',
  我的: '#/my',
}
const CANON = Object.values(EXPECT)
const LEGACY = ['#/featured', '#/douyin', '#/dark', '#/anime', '#/mine', '#/']

async function dismiss(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document
        .querySelectorAll('.van-popup__close-icon, .van-icon-cross, .popup-close, .close')
        .forEach((el) => {
          try {
            el.click()
          } catch {}
        })
      ;[...document.querySelectorAll('button,div,a,span')]
        .filter((el) => /进入|立即进入|继续|我已满|同意|开始/.test(el.innerText || ''))
        .slice(0, 3)
        .forEach((el) => {
          try {
            el.click()
          } catch {}
        })
    }).catch(() => {})
    await page.waitForTimeout(250)
  }
}

async function scrape(page) {
  return page.evaluate(() => {
    const items = [
      ...document.querySelectorAll(
        '.van-tabbar-item, nav.tabbar .tabbar-item, .tabbar > .tabbar-item',
      ),
    ]
    const bar = document.querySelector('nav.tabbar, .van-tabbar')
    return {
      hash: location.hash,
      href: location.href,
      bodyText: (document.body?.innerText || '').slice(0, 240),
      bar: bar
        ? {
            h: Math.round(bar.getBoundingClientRect().height),
            w: Math.round(bar.getBoundingClientRect().width),
            bg: getComputedStyle(bar).backgroundColor,
          }
        : null,
      items: items.map((el) => {
        const cs = getComputedStyle(el)
        const txt = (el.innerText || '').trim().split(/\s+/).filter(Boolean)
        const label = txt[txt.length - 1] || ''
        const img = el.querySelector('img')
        const svg = el.querySelector('svg')
        return {
          label,
          active:
            el.classList.contains('van-tabbar-item--active') ||
            el.classList.contains('is-active'),
          color: cs.color,
          fw: cs.fontWeight,
          hasImg: !!img,
          hasSvg: !!svg,
          imgSrc: img?.src?.slice(0, 180) || null,
        }
      }),
    }
  })
}

async function gotoHash(page, base, hash) {
  await page.goto(`${base}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await dismiss(page)
  const h = await page.evaluate(() => location.hash)
  if (h === '#/launch' || h === '#/login') {
    await page.evaluate((hash) => {
      location.hash = hash
    }, hash)
    await page.waitForTimeout(1800)
    await dismiss(page)
  }
}

async function probe(browser, base, site) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const out = { site, base, routes: [], legacy: [], direct: [], icons: null, error: null }
  try {
    await gotoHash(page, base, '#/appcenter')
    out.icons = await scrape(page)

    for (const [lab, expect] of Object.entries(EXPECT)) {
      const cur = await scrape(page)
      if (cur.items.length) {
        await page.evaluate((lab) => {
          const items = [
            ...document.querySelectorAll(
              '.van-tabbar-item, nav.tabbar .tabbar-item, .tabbar > .tabbar-item',
            ),
          ]
          const el = items.find((i) => (i.innerText || '').includes(lab))
          if (el) el.click()
        }, lab)
        await page.waitForTimeout(1100)
        await dismiss(page)
      } else {
        await gotoHash(page, base, expect)
      }
      const st = await scrape(page)
      out.routes.push({
        label: lab,
        expect,
        hash: st.hash,
        match: st.hash === expect,
        active: st.items.filter((i) => i.active).map((i) => i.label),
        itemCount: st.items.length,
        bar: st.bar,
        colors: st.items.map((i) => ({ l: i.label, a: i.active, c: i.color })),
      })
    }

    for (const from of LEGACY) {
      await gotoHash(page, base, from)
      const st = await scrape(page)
      out.legacy.push({
        from,
        to: st.hash,
        matchedCanon: CANON.includes(st.hash),
        items: st.items.length,
      })
    }

    for (const h of CANON) {
      await gotoHash(page, base, h)
      const st = await scrape(page)
      out.direct.push({
        hash: h,
        landed: st.hash,
        match: st.hash === h,
        active: st.items.filter((i) => i.active).map((i) => i.label),
        itemCount: st.items.length,
      })
    }
  } catch (e) {
    out.error = String(e)
  }
  await ctx.close()
  return out
}

const browser = await chromium.launch({ headless: true })
const origin = await probe(browser, ORIGIN, 'origin')
const clone = await probe(browser, CLONE, 'clone')
await browser.close()

const report = { at: new Date().toISOString(), origin, clone }
fs.writeFileSync('crawled/audit-9-tabbar-routes-live.json', JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    {
      originInit: {
        hash: origin.icons?.hash,
        n: origin.icons?.items?.length,
        labels: origin.icons?.items?.map((i) => i.label),
        icons: origin.icons?.items?.map((i) => ({
          l: i.label,
          img: i.hasImg,
          svg: i.hasSvg,
          c: i.color,
          a: i.active,
          src: i.imgSrc,
        })),
        bar: origin.icons?.bar,
      },
      originRoutes: origin.routes.map((r) => ({
        l: r.label,
        h: r.hash,
        m: r.match,
        a: r.active,
      })),
      originDirect: origin.direct,
      originLegacy: origin.legacy,
      originErr: origin.error,
      cloneInit: {
        hash: clone.icons?.hash,
        n: clone.icons?.items?.length,
        labels: clone.icons?.items?.map((i) => i.label),
        icons: clone.icons?.items?.map((i) => ({
          l: i.label,
          img: i.hasImg,
          svg: i.hasSvg,
          c: i.color,
          a: i.active,
        })),
        bar: clone.icons?.bar,
      },
      cloneRoutes: clone.routes.map((r) => ({
        l: r.label,
        h: r.hash,
        m: r.match,
        a: r.active,
      })),
      cloneDirect: clone.direct,
      cloneLegacy: clone.legacy,
      cloneErr: clone.error,
    },
    null,
    2,
  ),
)
