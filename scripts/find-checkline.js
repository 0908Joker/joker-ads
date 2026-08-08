import fs from 'fs'
import path from 'path'

const root = path.resolve('..')
const files = fs.readdirSync(root).filter(f => f.endsWith('.js'))

for (const file of files) {
  const c = fs.readFileSync(path.join(root, file), 'utf8')
  if (c.includes('getApiBaseUrl') || c.includes('checkLine')) {
    let idx = c.indexOf('getApiBaseUrl')
    while (idx >= 0) {
      console.log(`\n[${file}] getApiBaseUrl @ ${idx}`)
      console.log(c.slice(Math.max(0, idx - 100), idx + 400).replace(/\s+/g, ' '))
      idx = c.indexOf('getApiBaseUrl', idx + 1)
      if (idx > 0 && c.indexOf('getApiBaseUrl', idx) === idx) break
    }
  }
}

// Search fresh.html for base64 or json config blobs
const h = fs.readFileSync(path.join(root, 'fresh.html'), 'utf8')
const scriptMatches = h.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || []
console.log('\nInline scripts:', scriptMatches.length)
for (const s of scriptMatches.slice(0, 5)) {
  if (s.length < 5000 && !s.includes('webpackJsonp')) {
    console.log('\n--- script ---')
    console.log(s.slice(0, 800))
  }
}
