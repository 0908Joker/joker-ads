import fs from 'fs'
import path from 'path'

const root = path.resolve('..')
const content = ['app-main.js', 'app-bundle.js', 'commons.js', 'vendors.js']
  .map(f => fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : '')
  .join('\n')

// Extract API path segments used with axios/fetch patterns
const apiPaths = new Set()
const reList = [
  /["']([a-z][a-zA-Z0-9]*(?:\/[a-zA-Z0-9_-]+)+)["']/g,
  /url\s*:\s*["']([^"']+)["']/g,
  /path\s*:\s*["']([^"']+)["']/g,
]

for (const re of reList) {
  let m
  while ((m = re.exec(content))) {
    const p = m[1]
    if (p.includes('/') && !p.includes(' ') && p.length < 80 && !p.startsWith('http')) {
      if (/^(app|ad|user|users|video|videos|config|banner|home|launch|popup|application|channel|comic|novel|signin|captcha|module|collect|follow|recharge|diamond|energy|invite|survey|ticket|coupon|history|download|search|recommend|filter|short|record|sync|info|init|relation|reward|smscode|email|pwd|comment|tag|avtar|hate|collect|bought|canLike|auditing|super|ticket|energy|invitation|questionnaire|consume|exchange|actionStats|skip|adsVideo|module|all)/i.test(p)) {
        apiPaths.add(p)
      }
    }
  }
}

console.log([...apiPaths].sort().join('\n'))
