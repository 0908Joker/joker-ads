#!/usr/bin/env node
/**
 * Najin payment BFF — run on VPS behind nginx /pay-bff/
 * Secrets via environment only (see najin-pay.env.example).
 */
import crypto from 'crypto'
import http from 'http'
import { URL } from 'url'

const PORT = Number(process.env.NAJIN_BFF_PORT || 8787)
const MCH_ID = Number(process.env.NAJIN_MCH_ID || 0)
const KEY = process.env.NAJIN_KEY || ''
const CREATE_URL = process.env.NAJIN_CREATE_URL || 'http://pay.najin.cfd/api/pay/create_order'
const QUERY_URL = process.env.NAJIN_QUERY_URL || 'http://pay.najin.cfd/api/pay/query_order'
const NOTIFY_URL = process.env.NAJIN_NOTIFY_URL || 'https://al-ads.com/pay-bff/notify'
const RETURN_URL = process.env.NAJIN_RETURN_URL || 'https://b12sl5x.cn/#/recharge?paid=1'
const ALLOW_ORIGIN = process.env.NAJIN_ALLOW_ORIGIN || '*'

const PRODUCT = {
  wx: Number(process.env.NAJIN_PRODUCT_WX || 8002),
  ali: Number(process.env.NAJIN_PRODUCT_ALI || 8009),
}

const AMOUNT_LIMIT = {
  [PRODUCT.wx]: { min: 30, max: 500 },
  [PRODUCT.ali]: { min: 10, max: 500 },
}

function sign(params) {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] != null && params[k] !== '')
    .sort()
  const str = `${keys.map((k) => `${k}=${params[k]}`).join('&')}&key=${KEY}`
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase()
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw) return resolve({})
        if (req.headers['content-type']?.includes('application/json')) {
          return resolve(JSON.parse(raw))
        }
        return resolve(Object.fromEntries(new URLSearchParams(raw)))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || ALLOW_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function json(res, code, data, origin) {
  cors(res, origin)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function najinPost(url, params) {
  const body = new URLSearchParams({ ...params, sign: sign(params) })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return res.json()
}

function orderNo(kind) {
  return `FBI${Date.now()}${Math.random().toString(36).slice(2, 8)}${kind === 'gold' ? 'G' : 'V'}`
}

async function handleCreate(body, origin) {
  if (!MCH_ID || !KEY) {
    return { status: 500, data: { ok: false, message: 'pay_bff_not_configured' } }
  }
  const productId = Number(body.productId)
  const amountYuan = Number(body.amount)
  const kind = String(body.kind || 'vip')
  const packageName = String(body.packageName || 'VIP')

  if (!productId || !amountYuan) {
    return { status: 400, data: { ok: false, message: 'missing productId or amount' } }
  }

  const limit = AMOUNT_LIMIT[productId]
  if (!limit) {
    return { status: 400, data: { ok: false, message: 'unsupported productId' } }
  }
  if (amountYuan < limit.min || amountYuan > limit.max) {
    return {
      status: 400,
      data: { ok: false, message: `金额需在 ${limit.min}-${limit.max} 元之间` },
    }
  }

  const mchOrderNo = orderNo(kind)
  const params = {
    mchId: MCH_ID,
    productId,
    mchOrderNo,
    amount: Math.round(amountYuan * 100),
    notifyUrl: NOTIFY_URL,
    returnUrl: RETURN_URL,
    param2: `${kind}:${packageName}`.slice(0, 128),
  }

  const out = await najinPost(CREATE_URL, params)
  if (out.retCode !== 'SUCCESS') {
    return { status: 502, data: { ok: false, message: out.retMsg || out.errDes || 'create_order failed' } }
  }

  const payParams = out.payParams || {}
  return {
    status: 200,
    data: {
      ok: true,
      mchOrderNo,
      payOrderId: out.payOrderId,
      payUrl: payParams.payUrl || '',
      payMethod: payParams.payMethod || 'codeImg',
      productId,
      amount: amountYuan,
    },
  }
}

async function handleQuery(query, origin) {
  if (!MCH_ID || !KEY) {
    return { status: 500, data: { ok: false, message: 'pay_bff_not_configured' } }
  }
  const mchOrderNo = String(query.mchOrderNo || '')
  if (!mchOrderNo) {
    return { status: 400, data: { ok: false, message: 'missing mchOrderNo' } }
  }
  const out = await najinPost(QUERY_URL, { mchId: MCH_ID, mchOrderNo })
  if (out.retCode !== 'SUCCESS') {
    return { status: 502, data: { ok: false, message: out.retMsg || 'query failed' } }
  }
  const paid = Number(out.status) >= 2
  return {
    status: 200,
    data: { ok: true, paid, status: out.status, payOrderId: out.payOrderId, mchOrderNo },
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '*'
  if (req.method === 'OPTIONS') {
    cors(res, origin)
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  try {
    if (req.method === 'GET' && url.pathname === '/pay-bff/health') {
      return json(res, 200, { ok: true, mchId: MCH_ID || null }, origin)
    }

    if (req.method === 'POST' && url.pathname === '/pay-bff/create') {
      const body = await readBody(req)
      const result = await handleCreate(body, origin)
      return json(res, result.status, result.data, origin)
    }

    if (req.method === 'GET' && url.pathname === '/pay-bff/query') {
      const result = await handleQuery(Object.fromEntries(url.searchParams), origin)
      return json(res, result.status, result.data, origin)
    }

    if (req.method === 'POST' && url.pathname === '/pay-bff/notify') {
      const body = await readBody(req)
      console.log('[najin-notify]', JSON.stringify(body))
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      return res.end('success')
    }

    json(res, 404, { ok: false, message: 'not found' }, origin)
  } catch (e) {
    console.error('[pay-bff]', e)
    json(res, 500, { ok: false, message: String(e.message || e) }, origin)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`najin-pay-bff listening on 127.0.0.1:${PORT}`)
})
