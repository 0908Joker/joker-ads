#!/usr/bin/env node
/** Sync popup entries from API gridPopAds + actPopAds into config.json */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'src/data/config.json')
const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawled/api/in-page/browser-api.json'), 'utf8'))
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))

const popupAds = [...(api.getAllAD?.gridPopAds || []), ...(api.getAllAD?.actPopAds || [])]
const existingImages = new Map((config.popups || []).filter((p) => p.image).map((p) => [p.name, p.image]))

const popups = []
const seen = new Set()
for (const ad of popupAds) {
  if (!ad.name || seen.has(ad.name)) continue
  seen.add(ad.name)
  const image = existingImages.get(ad.name) || existingImages.get([...existingImages.keys()].find((k) => ad.name.includes(k) || k.includes(ad.name))) || ''
  if (!image) continue
  popups.push({
    name: ad.name,
    url: ad.orgUrl || ad.url || '',
    signUrl: ad.url && /ad\/sign/.test(ad.url) ? ad.url : '',
    image,
  })
}

if (popups.length) {
  config.popups = popups
  fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2))
  console.log(`✅ ${popups.length} popups synced from API (${popupAds.length} API entries)`)
} else {
  console.log('⚠️ no popups with images to sync')
}
