import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const API_TARGETS = [
  'https://deuwy.jcd9nw.com',
  'https://4p3kb.et8h6.cc',
  'https://34.92.209.217:16888',
  'https://180.188.198.189:16888',
]

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    fs: { strict: false },
    proxy: {
      '/data': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/api/public': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/api-proxy': {
        target: API_TARGETS[0],
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/api-proxy/, '/api/v1'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const u = new URL(req.url || '', 'http://local')
            const base = u.searchParams.get('base')
            if (base) {
              try {
                const t = new URL(base)
                proxyReq.setHeader('host', t.host)
              } catch {}
            }
          })
        },
      },
    },
  },
  build: {
    emptyOutDir: true,
  },
})
