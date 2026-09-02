#!/usr/bin/env node
/** Seed admin site-data from src/data/*.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = path.join(ROOT, 'admin', 'data', 'live')
const DRAFT = path.join(ROOT, 'admin', 'data', 'draft')
const SRC = path.join(ROOT, 'src', 'data')

for (const dir of [LIVE, DRAFT]) fs.mkdirSync(dir, { recursive: true })

for (const name of ['config.json', 'popups.json', 'tabs.json']) {
  const src = path.join(SRC, name)
  if (!fs.existsSync(src)) continue
  fs.copyFileSync(src, path.join(LIVE, name))
  fs.copyFileSync(src, path.join(DRAFT, name))
}

const meta = { version: 1, publishedAt: new Date().toISOString() }
fs.writeFileSync(path.join(LIVE, 'meta.json'), JSON.stringify(meta, null, 2))
fs.writeFileSync(path.join(DRAFT, 'meta.json'), JSON.stringify(meta, null, 2))
console.log('seeded site-data to admin/data/{live,draft}')
