import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://localhost:5173/#/appcenter', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const close = page.locator('button', { hasText: '关闭' })
if (await close.count()) await close.first().click()
await page.waitForTimeout(500)

const stats = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('.cover-img--real')]
  return {
    total: imgs.length,
    loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
    pending: imgs.filter((i) => !i.complete).length,
    sample: imgs.slice(0, 5).map((i) => ({
      src: i.src,
      nw: i.naturalWidth,
      complete: i.complete,
    })),
  }
})

console.log(JSON.stringify(stats, null, 2))
await page.screenshot({ path: 'verify-grid.png' })
await browser.close()
