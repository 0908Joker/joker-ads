#!/usr/bin/env node
/** 从原站爬取 P1/P2 全量 Feed 数据 → src/data/feeds.json */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/data/feeds.json')
const IMG_DIR = path.join(ROOT, 'public/feeds')
const SITE = 'https://fbi.xdx794.com'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

const hash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10)

async function dismissPopups(page) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate(() => {
      document.querySelectorAll('.van-popup__close-icon, .van-icon-cross, .van-overlay').forEach((el) => el.click?.())
    })
    await page.waitForTimeout(120)
  }
}

async function saveImg(page, src) {
  if (!src || src.startsWith('data:image/svg')) return ''
  try {
    let buf
    if (src.startsWith('data:image/')) {
      buf = Buffer.from(src.split(',')[1], 'base64')
    } else if (src.startsWith('blob:')) {
      const bytes = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), src)
      buf = Buffer.from(bytes)
    } else if (/^https?:/.test(src)) {
      const r = await page.request.get(src, { timeout: 15000 })
      if (!r.ok()) return ''
      buf = Buffer.from(await r.body())
    } else return ''
    const ext = buf[0] === 0x47 ? '.gif' : buf[0] === 0xFF ? '.jpg' : '.png'
    const file = `${hash(src)}${ext}`
    fs.mkdirSync(IMG_DIR, { recursive: true })
    fs.writeFileSync(path.join(IMG_DIR, file), buf)
    return `/feeds/${file}`
  } catch { return '' }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto(`${SITE}/#/launch`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissPopups(page)

  const feeds = { at: new Date().toISOString() }

  // 精选
  await page.goto(`${SITE}/#/videosPage`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await dismissPopups(page)
  const featured = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.van-tab, .hero__tab, nav button')].map((el) => el.textContent?.trim()).filter(Boolean)
    const chips = [...document.querySelectorAll('.tag-item, .filter-item, [class*="chip"]')].map((el) => el.textContent?.trim()).filter((t) => t && t.length < 20)
    const cards = [...document.querySelectorAll('.twoItem, .imgBox, .video-item, [class*="video"]')].slice(0, 20)
    const videos = []
    for (const el of cards) {
      const title = el.querySelector('[class*="title"], .name, h3, h4')?.textContent?.trim() || el.textContent?.trim()?.slice(0, 80)
      const img = el.querySelector('img')
      const meta = el.textContent?.match(/([\d.]+[wk]?)\s*·?\s*(\d{1,2}:\d{2}(?::\d{2})?)/i)
      if (title && title.length > 4) videos.push({ title, cover: img?.src || '', views: meta?.[1] || '', duration: meta?.[2] || '' })
    }
    return { tabs: [...new Set(tabs)].slice(0, 15), chips: [...new Set(chips)].slice(0, 12), videos: videos.slice(0, 12) }
  })
  for (const v of featured.videos) v.coverLocal = await saveImg(page, v.cover)
  feeds.featured = featured
  console.log('featured videos', featured.videos.length)

  // 抖阴
  await page.goto(`${SITE}/#/short`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await dismissPopups(page)
  const douyin = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.van-tab')].map((el) => el.textContent?.trim()).filter(Boolean)
    const slides = [...document.querySelectorAll('.van-swipe-item, .swiper-slide, .short-item')].slice(0, 8)
    return slides.map((el) => {
      const video = el.querySelector('video')
      const img = el.querySelector('img')
      const user = el.querySelector('[class*="name"], .user')?.textContent?.trim() || ''
      const title = el.textContent?.trim()?.slice(0, 60) || ''
      return { user, title, video: video?.src || '', poster: img?.src || video?.poster || '', likes: (el.textContent?.match(/(\d+)\s*分享/) || [])[1] || '' }
    }).filter((x) => x.title || x.user)
  })
  for (const d of douyin) {
    d.posterLocal = await saveImg(page, d.poster)
    if (d.video?.startsWith('blob:')) d.videoLocal = await saveImg(page, d.video) // fallback
  }
  feeds.douyin = { tabs: ['抖阴', '福利姬', 'TikTok', 'AI', '动漫', '短剧'], items: douyin }
  console.log('douyin items', douyin.length)

  // 暗网
  await page.goto(`${SITE}/#/darkWeb/darkSecond`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2500)
  feeds.dark = await page.evaluate(() => ({
    tags: [...document.querySelectorAll('button, a, span')].map((el) => el.textContent?.trim()).filter((t) => t && t.length <= 6 && /[\u4e00-\u9fa5]/.test(t)).slice(0, 12),
  }))
  feeds.dark.tags = [...new Set(feeds.dark.tags)].slice(0, 8)
  console.log('dark tags', feeds.dark.tags.length)

  // 圈子
  await page.goto(`${SITE}/#/circle`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await dismissPopups(page)
  const circle = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[class*="circle"], .group-item, .hot-group')].slice(0, 12).map((el) => ({
      name: el.textContent?.match(/^[\u4e00-\u9fa5a-zA-Z0-9]+/)?.[0] || el.textContent?.trim().slice(0, 12),
      count: (el.textContent?.match(/(\d+个帖子)/) || [])[1] || '',
    })).filter((g) => g.name)
    const posts = [...document.querySelectorAll('.waterfall-item, .post-item, [class*="feed"] > div, .circle-content')].slice(0, 15).map((el) => {
      const img = el.querySelector('img')
      return {
        user: el.querySelector('[class*="name"], strong')?.textContent?.trim()?.slice(0, 30) || '',
        time: (el.textContent?.match(/\d{4}\.\d{1,2}\.\d{1,2}/) || [])[0] || '',
        title: el.textContent?.trim().slice(0, 120),
        tag: (el.textContent?.match(/#\S+/) || [])[0] || '',
        cover: img?.src || '',
      }
    }).filter((p) => p.title?.length > 10)
    return { groups: [...new Map(groups.map((g) => [g.name, g])).values()].slice(0, 9), posts: posts.slice(0, 10) }
  })
  for (const p of circle.posts) p.coverLocal = await saveImg(page, p.cover)
  feeds.circle = circle
  console.log('circle posts', circle.posts.length)

  // 二次元
  await page.goto(`${SITE}/#/vipPage`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  const anime = await page.evaluate(() => {
    const comics = [...document.querySelectorAll('[class*="comic"], .book-item, .van-grid-item')].slice(0, 20).map((el) => {
      const img = el.querySelector('img')
      const t = el.textContent?.trim() || ''
      return {
        title: t.split(/\s/)[0]?.slice(0, 20) || t.slice(0, 20),
        type: (t.match(/韩漫|女性向|同人|连载/) || [])[0] || '韩漫',
        status: (t.match(/连载|完结/) || [])[0] || '连载',
        cover: img?.src || '',
      }
    }).filter((c) => c.title.length > 1)
    return { comics: [...new Map(comics.map((c) => [c.title, c])).values()].slice(0, 12) }
  })
  for (const c of anime.comics) c.coverLocal = await saveImg(page, c.cover)
  feeds.anime = anime
  console.log('anime comics', anime.comics.length)

  // 我的
  await page.goto(`${SITE}/#/my`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const mine = await page.evaluate(() => {
    const text = document.body.innerText
    const id = (text.match(/ID:\s*(\d+)/) || [])[1] || ''
    const name = document.querySelector('[class*="nickname"], .user-name, h2')?.textContent?.trim() || (text.match(/ID:\s*\d+\s*(\S+)/) || [])[1] || ''
    const version = (text.match(/v[\d.]+/) || [])[0] || 'v1.1.168'
    const quickApps = [...document.querySelectorAll('.my-app-item, [class*="recommend"] img, .scroll-app img')].map((img) => ({
      name: img.alt || img.closest('div')?.textContent?.trim()?.slice(0, 8) || '',
      icon: img.src || '',
    })).filter((a) => a.name)
    return { user: { id, name, bio: '这家伙很懒，什么也没有留下…' }, stats: { follow: 0, like: 0, fav: 0 }, version, quickApps: quickApps.slice(0, 12) }
  })
  for (const a of mine.quickApps) a.iconLocal = await saveImg(page, a.icon)
  feeds.mine = mine
  console.log('mine user', mine.user.name)

  fs.writeFileSync(OUT, JSON.stringify(feeds, null, 2))
  console.log(`✅ ${OUT}`)
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
