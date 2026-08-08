import fs from 'fs'

const c = fs.readFileSync('../app-main.js', 'utf8')

const keywords = [
  'apiUrls', 'launch', '$env', 'encryptedConfig', 'configCipher',
  'app/module', 'recordLogin', 'getCaptcha', 'signin',
  'downloadGif', 'limitedtimeUnlock', '.gif',
  'normalizeApiUrl', 'checkLine', 'initApi',
]

for (const k of keywords) {
  let idx = 0, count = 0
  while ((idx = c.indexOf(k, idx)) >= 0 && count < 2) {
    console.log(`\n=== ${k} @ ${idx} ===`)
    console.log(c.slice(Math.max(0, idx - 120), idx + 250).replace(/\s+/g, ' '))
    idx++
    count++
  }
}
