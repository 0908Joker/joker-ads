import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://51-pc.com/#/appcenter', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

// close popup if any
const close = page.locator('button[aria-label="关闭"]')
if (await close.count()) await close.first().click().catch(() => {})

const stats = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('.cover-img--real')]
  return {
    total: imgs.length,
    gifSrc: imgs.filter((i) => i.src.includes('.gif')).length,
    pngSrc: imgs.filter((i) => i.src.includes('.png')).length,
    sample: imgs.slice(0, 5).map((i) => ({ src: i.src.split('/').pop(), nw: i.naturalWidth, complete: i.complete })),
  }
})

console.log(JSON.stringify(stats, null, 2))
await page.screenshot({ path: 'live-check.png', fullPage: false })
await browser.close()
