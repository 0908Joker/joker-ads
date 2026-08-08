import fs from 'fs'

const c = fs.readFileSync('../launch.js', 'utf8')
const markers = ['signin({', 'checkFastApiUrl', 'apiDomains', 'getCaptcha', 'showEnterAppAd', '6684079375', 'verifyType']

for (const m of markers) {
  let idx = 0, n = 0
  while ((idx = c.indexOf(m, idx)) >= 0 && n < 2) {
    console.log(`\n=== ${m} ===`)
    console.log(c.slice(idx, idx + 600).replace(/\s+/g, ' '))
    idx++
    n++
  }
}
