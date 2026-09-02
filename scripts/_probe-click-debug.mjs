import { chromium } from "playwright"
const CLONE = process.env.CLONE_URL || "https://b12sl5x.cn"
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  viewport: { width: 390, height: 844 },
})
await ctx.addInitScript(() => {
  window.__opens = []
  window.__clicks = []
  const orig = window.open
  window.open = function (url, ...a) {
    window.__opens.push(String(url || ""))
    return null
  }
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target
      window.__clicks.push({
        tag: t?.tagName,
        cls: (t?.className || "").toString().slice(0, 80),
        text: (t?.innerText || "").slice(0, 40),
      })
    },
    true,
  )
})
const page = await ctx.newPage()
await page.goto(CLONE + "/#/appcenter", { waitUntil: "domcontentloaded", timeout: 90000 })
await page.waitForTimeout(5000)
const overlay = await page.evaluate(() => {
  const cards = document.querySelectorAll(".app-card")
  const first = cards[0]
  const r = first?.getBoundingClientRect()
  const topEl = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
  return {
    cards: cards.length,
    firstName: first?.querySelector(".app-card__name")?.textContent,
    rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
    topTag: topEl?.tagName,
    topCls: (topEl?.className || "").toString().slice(0, 100),
    hasPopup: !!document.querySelector(".van-popup, .ad-popup, .popup-wrap"),
    float: !!document.querySelector(".float-banner"),
  }
})
console.log("overlay", JSON.stringify(overlay, null, 2))
await page.locator(".app-card").first().click({ force: true })
await page.waitForTimeout(500)
const afterForce = await page.evaluate(() => ({ opens: window.__opens, clicks: window.__clicks.slice(-5) }))
console.log("afterForce", JSON.stringify(afterForce, null, 2))
// direct evaluate emit
const direct = await page.evaluate(() => {
  window.__opens = []
  const btn = document.querySelector(".app-card")
  btn?.click()
  return { opens: window.__opens, name: btn?.querySelector(".app-card__name")?.textContent }
})
console.log("direct", JSON.stringify(direct, null, 2))
// check if onAppClick exists by reading vue
const vueHint = await page.evaluate(() => {
  const btn = document.querySelector(".app-card")
  const keys = btn ? Object.keys(btn).filter((k) => k.startsWith("__vue")) : []
  return { keys, html: btn?.outerHTML?.slice(0, 200) }
})
console.log("vueHint", JSON.stringify(vueHint, null, 2))
await browser.close()
