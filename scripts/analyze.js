import fs from 'fs'
import path from 'path'

const root = path.resolve('..')
const files = ['source.html', 'vendors.js', 'app-main.js', 'app-bundle.js', 'commons.js', 'web-sdk.js', 'appcenter.js']

const patterns = [
  /https?:\/\/[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g,
  /\/api\/[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g,
  /"apiUrls"\s*:\s*\[[^\]]+\]/g,
  /apiUrl[s]?\s*[:=]\s*["'][^"']+["']/g,
  /["'][^"']*\.gif(?:\?[^"']*)?["']/gi,
  /["'][^"']*\.(png|jpg|jpeg|webp)(?:\?[^"']*)?["']/gi,
]

const found = { urls: new Set(), apis: new Set(), gifs: new Set(), images: new Set(), apiConfig: [] }

for (const file of files) {
  const fp = path.join(root, file)
  if (!fs.existsSync(fp)) continue
  const content = fs.readFileSync(fp, 'utf8')
  console.log(`\n=== ${file} (${(content.length / 1024 / 1024).toFixed(2)} MB) ===`)

  for (const re of patterns) {
    const matches = content.match(re) || []
    for (const m of matches) {
      if (re.source.includes('apiUrls')) found.apiConfig.push(m.slice(0, 500))
      else if (m.includes('.gif')) found.gifs.add(m.replace(/['"]/g, ''))
      else if (/\.(png|jpg|jpeg|webp)/i.test(m)) found.images.add(m.replace(/['"]/g, ''))
      else if (m.startsWith('/api')) found.apis.add(m)
      else if (m.startsWith('http')) found.urls.add(m)
    }
  }
}

console.log('\n--- API Config snippets ---')
found.apiConfig.slice(0, 5).forEach(s => console.log(s))

console.log('\n--- API paths ---')
;[...found.apis].slice(0, 30).forEach(u => console.log(u))

console.log('\n--- Unique HTTP URLs ---')
;[...found.urls].filter(u => !u.includes('vuejs.org') && !u.includes('w3.org')).slice(0, 50).forEach(u => console.log(u))

console.log('\n--- GIFs ---')
;[...found.gifs].slice(0, 30).forEach(u => console.log(u))

console.log('\n--- Stats ---')
console.log({ urls: found.urls.size, apis: found.apis.size, gifs: found.gifs.size, images: found.images.size })
