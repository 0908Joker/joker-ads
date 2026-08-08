#!/usr/bin/env node
/** 从 browser-api.json 提取全部链接层级树 + GIF 列表 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'crawled')

const api = JSON.parse(fs.readFileSync(path.join(OUT, 'api/in-page/browser-api.json'), 'utf8'))
const resBase = api.resBase || 'https://cdim.s3.ap-east-1.amazonaws.com'

const links = []
const gifs = []
const tree = { name: 'root', children: [] }

function walk(obj, pathParts = [], depth = 0) {
  if (depth > 20 || obj == null) return
  if (typeof obj === 'string') {
    if (/^https?:\/\//i.test(obj)) {
      links.push({ path: pathParts.join('.'), url: obj })
      if (/\.gif/i.test(obj)) gifs.push(obj)
    } else if (/\.(gif|png|jpg|jpeg|webp|ceb)/i.test(obj)) {
      const full = obj.startsWith('http') ? obj : `${resBase}/${obj.replace(/^\//, '')}`
      links.push({ path: pathParts.join('.'), url: full, relative: obj })
      if (/\.gif/i.test(obj)) gifs.push(full)
    }
    return
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, [...pathParts, `[${i}]`], depth + 1))
    return
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (['jumpUrl', 'linkUrl', 'href', 'url', 'downloadUrl', 'coverUrl', 'imgUrl', 'iconUrl', 'gifUrl', 'imageUrl', 'picUrl', 'bannerUrl'].includes(k)) {
        walk(v, [...pathParts, k], depth + 1)
      } else if (typeof v === 'object') {
        walk(v, [...pathParts, k], depth + 1)
      }
    }
  }
}

walk(api)

const uniqueLinks = [...new Map(links.map(l => [l.url, l])).values()]
const uniqueGifs = [...new Set(gifs)]

// 构建层级树
for (const l of uniqueLinks) {
  const parts = l.path.split('.')
  let node = tree
  for (const p of parts) {
    let child = node.children?.find(c => c.name === p)
    if (!child) {
      child = { name: p, children: [] }
      node.children = node.children || []
      node.children.push(child)
    }
    node = child
  }
  node.url = l.url
  node.relative = l.relative
}

fs.writeFileSync(path.join(OUT, 'links-flat.json'), JSON.stringify(uniqueLinks, null, 2))
fs.writeFileSync(path.join(OUT, 'links-tree.json'), JSON.stringify(tree, null, 2))
fs.writeFileSync(path.join(OUT, 'gifs-list.json'), JSON.stringify(uniqueGifs, null, 2))

console.log(`链接: ${uniqueLinks.length}, GIF: ${uniqueGifs.length}`)
uniqueGifs.forEach(g => console.log(' GIF:', g))
