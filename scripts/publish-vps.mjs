#!/usr/bin/env node
/**
 * Publish dist/ to the VPS site root (primary production).
 *
 * Host: 107.149.129.35  Path: /www/wwwroot/b12sl5x.cn
 * Key:  ~/.ssh/cr7_local_workstation_ed25519  Port: 32356
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const DIST = path.join(process.cwd(), 'dist')
const HOST = process.env.DEPLOY_HOST || '107.149.129.35'
const PORT = process.env.DEPLOY_PORT || '32356'
const USER = process.env.DEPLOY_USER || 'root'
const REMOTE = process.env.DEPLOY_PATH || '/www/wwwroot/b12sl5x.cn'
const KEY =
  process.env.DEPLOY_KEY ||
  path.join(os.homedir(), '.ssh', 'cr7_local_workstation_ed25519')

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html missing — run `npm run build` first.')
  process.exit(1)
}
if (!fs.existsSync(KEY)) {
  console.error(`SSH key missing: ${KEY}`)
  process.exit(1)
}

const remote =
  `mkdir -p ${REMOTE} && tar xzf - -C ${REMOTE} && chown -R www:www ${REMOTE} && ` +
  `grep -oE 'index-[A-Za-z0-9_-]+\\.js' ${REMOTE}/index.html | head -1`

const distPosix = DIST.replace(/\\/g, '/')
const keyPosix = KEY.replace(/\\/g, '/')
const cmd =
  `tar czf - -C "${distPosix}" . | ssh -p ${PORT} -i "${keyPosix}" ` +
  `-o StrictHostKeyChecking=accept-new -o BatchMode=yes ` +
  `${USER}@${HOST} "${remote}"`

console.log(`deploying dist/ → ${USER}@${HOST}:${REMOTE}`)
const r = spawnSync(cmd, { shell: true, stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status || 1)
console.log(`published to VPS ${HOST}`)
