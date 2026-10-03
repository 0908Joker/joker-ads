import CryptoJS from 'crypto-js'
import session from '../data/api-session.json'
import { withRequestDeadline } from './timedFetch.js'

const RES_BASE = (session.resBase || 'https://d17e80montytxe.cloudfront.net').replace(/\/$/, '')
const IMG_KEY = '82758dd12749c777ef579f1839ceea6a'
const cache = new Map()

export function mediaUrl(path) {
  if (!path) return ''
  const clean = String(path).split('@')[0]
  if (/^(https?:|data:|blob:|\/)/i.test(clean)) return clean
  return `${RES_BASE}/${clean.replace(/^\/+/, '')}`
}

export function isEncryptedMedia(path) {
  return /\.(ceb|geb)(\?|$)/i.test(String(path || '').split('@')[0])
}

function toWordArray(u8) {
  const words = []
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      ((u8[i] || 0) << 24) |
        ((u8[i + 1] || 0) << 16) |
        ((u8[i + 2] || 0) << 8) |
        (u8[i + 3] || 0),
    )
  }
  return CryptoJS.lib.WordArray.create(words, u8.length)
}

function decryptToDataUrl(u8) {
  const k = CryptoJS.enc.Utf8.parse(IMG_KEY)
  const dec = CryptoJS.AES.decrypt({ ciphertext: toWordArray(u8) }, k, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })
  let text = ''
  try {
    text = CryptoJS.enc.Utf8.stringify(dec)
  } catch {
    text = CryptoJS.enc.Latin1.stringify(dec)
  }
  return text.startsWith('data:image/') ? text : ''
}

export async function decryptMedia(path, options = {}) {
  if (!path) return ''
  if (/^(data:|blob:)/i.test(path)) return path
  if (path.startsWith('/') && !isEncryptedMedia(path)) return path
  if (!isEncryptedMedia(path) && /\.(gif|png|jpe?g|webp)(\?|$)/i.test(path)) return mediaUrl(path)

  const url = mediaUrl(path)
  if (cache.has(url)) return withRequestDeadline(() => cache.get(url), 5000, options.signal)

  const pending = withRequestDeadline(async signal => {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`media ${res.status}`)
    const u8 = new Uint8Array(await res.arrayBuffer())
    if (!isEncryptedMedia(url)) return URL.createObjectURL(new Blob([u8]))
    const dataUrl = decryptToDataUrl(u8)
    if (!dataUrl) throw new Error('decrypt failed')
    return dataUrl
  }, 5000, options.signal)

  if (!options.signal) cache.set(url, pending)
  try {
    const out = await pending
    cache.set(url, out)
    return out
  } catch (e) {
    if (cache.get(url) === pending) cache.delete(url)
    throw e
  }
}
