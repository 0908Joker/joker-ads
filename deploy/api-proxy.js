/**
 * Cloudflare Worker — mount at 51-pc.com/api/v1/*
 * Dashboard: Workers Routes → 51-pc.com/api/v1* → this worker
 */
const TARGETS = [
  'https://deuwy.jcd9nw.com',
  'https://4p3kb.et8h6.cc',
  'https://34.92.209.217:16888',
  'https://180.188.198.189:16888',
]

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api\/v1/, '/api/v1')
    const qs = url.search

    for (const base of TARGETS) {
      try {
        const target = `${base}${path}${qs}`
        const res = await fetch(target, {
          method: request.method,
          headers: {
            Accept: 'application/json',
            'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
          },
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        })
        if (res.ok || res.status < 500) {
          const headers = new Headers(res.headers)
          headers.set('Access-Control-Allow-Origin', '*')
          headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          return new Response(res.body, { status: res.status, headers })
        }
      } catch {}
    }

    return new Response(JSON.stringify({ error: 'proxy_fail' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  },
}
