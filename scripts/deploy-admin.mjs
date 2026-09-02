#!/usr/bin/env node
/** Deploy admin BFF + site-data to VPS */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = process.cwd()
const HOST = process.env.DEPLOY_HOST || '107.149.129.35'
const PORT = process.env.DEPLOY_PORT || '32356'
const KEY = process.env.DEPLOY_KEY || path.join(os.homedir(), '.ssh', 'cr7_local_workstation_ed25519')

function sh(cmd) {
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
}

if (!fs.existsSync(KEY)) {
  console.error('SSH key missing:', KEY)
  process.exit(1)
}

spawnSync('npm', ['run', 'seed:site-data'], { stdio: 'inherit', shell: true, cwd: ROOT })
spawnSync('npm', ['run', 'admin:install'], { stdio: 'inherit', shell: true, cwd: ROOT })

const keyPosix = KEY.replace(/\\/g, '/')
const adminPosix = path.join(ROOT, 'admin').replace(/\\/g, '/')

sh(`tar czf - -C "${adminPosix}" --exclude=node_modules --exclude=data/admin.sqlite . | ssh -p ${PORT} -i "${keyPosix}" -o StrictHostKeyChecking=accept-new root@${HOST} "mkdir -p /opt/ads-king/admin /opt/ads-king/site-data /opt/ads-king/uploads && rm -rf /opt/ads-king/admin/node_modules && tar xzf - -C /opt/ads-king/admin"`)

sh(`scp -P ${PORT} -i "${keyPosix}" deploy/ads-king-admin.service deploy/ads-king-admin.env.example deploy/admin.b12sl5x.cn.conf root@${HOST}:/tmp/`)

sh(`ssh -p ${PORT} -i "${keyPosix}" root@${HOST} "mkdir -p /opt/ads-king/site-data/live /opt/ads-king/site-data/draft /opt/ads-king/uploads/popups /opt/ads-king/uploads/icons /opt/ads-king/uploads/promo /opt/ads-king/data && cp -rn /opt/ads-king/admin/data/live/* /opt/ads-king/site-data/live/ 2>/dev/null || true && cp -rn /opt/ads-king/admin/data/draft/* /opt/ads-king/site-data/draft/ 2>/dev/null || true && test -f /etc/ads-king/admin.env || cp /tmp/ads-king-admin.env.example /etc/ads-king/admin.env && cp /tmp/ads-king-admin.service /etc/systemd/system/ && cp /tmp/admin.b12sl5x.cn.conf /www/server/panel/vhost/nginx/admin.b12sl5x.cn.conf && cd /opt/ads-king/admin && npm install --omit=dev && systemctl daemon-reload && systemctl enable ads-king-admin && systemctl restart ads-king-admin && nginx -t && nginx -s reload"`)

console.log('admin deployed to', HOST)
