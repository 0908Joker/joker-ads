import fs from 'fs'
import path from 'path'

const root = path.resolve('..')
const files = fs.readdirSync(root).filter(f => f.endsWith('.js') || f === 'source.html')

const endpointRe = /["'](\/api\/v1\/[a-zA-Z0-9_/.-]+)["']/g
const pathRe = /["'](\/[a-zA-Z0-9_/.-]{3,50})["']/g
const gifRe = /["']([^"']*\.gif(?:\?[^"']*)?)["']/gi
const apiHostRe = /https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/api\/v1\/?/g

const endpoints = new Set()
const paths = new Set()
const gifs = new Set()
const apiHosts = new Set()

for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8')
  let m
  while ((m = endpointRe.exec(content))) endpoints.add(m[1])
  while ((m = apiHostRe.exec(content))) apiHosts.add(m[0])
  while ((m = gifRe.exec(content))) {
    const g = m[1]
    if (g.length > 4 && !g.startsWith('.')) gifs.add(g)
  }
}

// Also search for common REST patterns
for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8')
  const rest = content.match(/["'][a-z]+(?:\/[a-zA-Z0-9_-]+){1,4}["']/g) || []
  for (const r of rest) {
    const p = r.replace(/['"]/g, '')
    if (/^(app|config|user|banner|ad|video|channel|home|launch|popup|category|application)/i.test(p)) {
      paths.add(p)
    }
  }
}

console.log('API Hosts:')
;[...apiHosts].forEach(h => console.log(' ', h))

console.log('\nAPI Endpoints:')
;[...endpoints].sort().forEach(e => console.log(' ', e))

console.log('\nRelevant paths:')
;[...paths].sort().slice(0, 80).forEach(p => console.log(' ', p))

console.log('\nGIFs:')
;[...gifs].sort().forEach(g => console.log(' ', g))
