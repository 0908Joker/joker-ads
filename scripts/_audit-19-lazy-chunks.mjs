import { chromium } from 'playwright'
import fs from 'fs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
})
const hits = []
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('/app/1.1.177/') && u.endsWith('.js')) hits.push(u)
})

const routes = [
  '#/recharge/goldRecharge',
  '#/recharge/help',
  '#/recharge/rechargeRecord',
  '#/recharge/buyRecord',
  '#/recharge/exchangeCenter',
  '#/pointsMall',
  '#/myBenefits',
  '#/message',
  '#/my/share',
  '#/activityPage/dailyCheckIn',
  '#/activityPage/membership',
  '#/recharge?type=vip',
  '#/recharge?type=gold',
]

const pages = {}
for (const h of routes) {
  await page.goto('https://fbi.xdx794.com/' + h, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(1400)
  const sample = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 220)
  pages[h] = { hash: await page.evaluate(() => location.hash), sample }
}

const out = { hits: [...new Set(hits)].sort(), pages }
fs.writeFileSync('crawled/_audit-19-lazy-chunks.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
await browser.close()
