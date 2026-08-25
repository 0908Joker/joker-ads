import CryptoJS from 'crypto-js'
import { inflate, ungzip } from 'pako'

const DEFAULT_KEY = 'tL3LkTOEouYphOPB94wJpbtEEUHJ4hI5'

// Payloads arrive gzip-wrapped; older ones were raw deflate, so accept both.
function decompressToText(raw) {
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? ungzip(raw) : inflate(raw)
  return new TextDecoder('utf-8').decode(bytes)
}

export function decryptCipher(cipher, key = DEFAULT_KEY) {
  if (!cipher || typeof cipher !== 'string') return null
  try {
    const k = CryptoJS.enc.Utf8.parse(key)
    const dec = CryptoJS.AES.decrypt(cipher, k, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    })
    let b64text = ''
    try {
      b64text = CryptoJS.enc.Utf8.stringify(dec)
    } catch {
      b64text = CryptoJS.enc.Latin1.stringify(dec)
    }
    if (!b64text) return null
    const raw = Uint8Array.from(atob(b64text), (c) => c.charCodeAt(0))
    return JSON.parse(decompressToText(raw))
  } catch {
    return null
  }
}

export function unwrapApiPayload(json) {
  if (!json || json.errorCode !== 0) return null
  if (json.data && typeof json.data === 'object') return json.data
  if (typeof json.data === 'string') return decryptCipher(json.data)
  return json.data ?? null
}
