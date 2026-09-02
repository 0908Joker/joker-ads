const PAY_BFF =
  (import.meta.env.VITE_PAY_BFF_ORIGIN || import.meta.env.VITE_API_PROXY_ORIGIN || '').replace(/\/$/, '')

export const NAJIN_PRODUCTS = {
  wx: { id: 8002, name: '微信原生纯视频', min: 30, max: 500 },
  ali: { id: 8009, name: '支付宝原生纯视频', min: 10, max: 500 },
}

function bffUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (PAY_BFF) return `${PAY_BFF}/pay-bff${p}`
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') return `/pay-bff${p}`
    if (/(^|\.)b12sl5x\.cn$/i.test(h) || /(^|\.)al-ads\.com$/i.test(h)) return `/pay-bff${p}`
  }
  return `https://al-ads.com/pay-bff${p}`
}

export async function createNajinOrder({ productId, amount, kind, packageName }) {
  const res = await fetch(bffUrl('/create'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, amount, kind, packageName }),
  })
  const json = await res.json()
  if (!res.ok || !json.ok) {
    throw new Error(json.message || `支付下单失败 (${res.status})`)
  }
  return json
}

export async function queryNajinOrder(mchOrderNo) {
  const res = await fetch(`${bffUrl('/query')}?mchOrderNo=${encodeURIComponent(mchOrderNo)}`, {
    headers: { Accept: 'application/json' },
  })
  const json = await res.json()
  if (!res.ok || !json.ok) {
    throw new Error(json.message || '查询失败')
  }
  return json
}
