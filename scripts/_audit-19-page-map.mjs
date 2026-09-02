import fs from 'fs'

const mapJs = await (await fetch('https://fbi.xdx794.com/app/1.1.177/284bb63.js')).text()
const pages = [...mapJs.matchAll(/"(pages\/(?:my|recharge|pointsMall|myBenefits|message|activityPage)[^"]*)"/g)].map(
  (m) => m[1],
)
const uniq = [...new Set(pages)].sort()
console.log(uniq.join('\n'))

const myEntry = [...mapJs.matchAll(/(\d+):"(pages\/my(?:\/[^"]*)?)"/g)].map((m) => ({ id: m[1], path: m[2] }))
const rechargeEntry = [...mapJs.matchAll(/(\d+):"(pages\/recharge(?:\/[^"]*)?)"/g)].map((m) => ({
  id: m[1],
  path: m[2],
}))
console.log('MY', JSON.stringify(myEntry, null, 2))
console.log('RECHARGE', JSON.stringify(rechargeEntry, null, 2))

const html = await (await fetch('https://fbi.xdx794.com/')).text()
fs.writeFileSync('crawled/_audit-19-origin-index.html', html)
const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1])
console.log('SCRIPTS', scripts)

// Try common chunk paths for my page
const candidates = [
  'https://fbi.xdx794.com/app/1.1.177/pages/my.js',
  'https://fbi.xdx794.com/app/1.1.177/pages/my/index.js',
  'https://fbi.xdx794.com/app/1.1.177/pages/my-index.js',
]
for (const u of candidates) {
  try {
    const r = await fetch(u)
    console.log(u, r.status, r.headers.get('content-type'))
  } catch (e) {
    console.log(u, String(e))
  }
}

// Search webpack jsonp chunk map in mapJs for numeric ids near my
const aroundMy = mapJs.indexOf('pages/my"')
console.log('AROUND_MY', mapJs.slice(Math.max(0, aroundMy - 80), aroundMy + 200))
