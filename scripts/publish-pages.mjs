#!/usr/bin/env node
/**
 * Publish dist/ to the gh-pages branch.
 *
 * Pages serves from the gh-pages branch (build_type=legacy) rather than an
 * Actions workflow, so pushing main no longer deploys anything — run this.
 * The switch was made during a GitHub Actions outage that left deploys queued
 * for over an hour; branch builds run on GitHub's own Pages builder instead.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const BRANCH = 'gh-pages'

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim()
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html missing — run `npm run build` first.')
  process.exit(1)
}

// Custom domain and Jekyll opt-out must ship inside the published tree.
fs.writeFileSync(path.join(DIST, 'CNAME'), 'b12sl5x.cn\n')
fs.writeFileSync(path.join(DIST, '.nojekyll'), '')

const head = git(['rev-parse', '--short', 'HEAD'])
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ghpages-'))
// A fresh orphan name each run; `--orphan gh-pages` fails once the local
// branch exists, and the published tree is a full replacement anyway.
const staging = `gh-pages-staging-${Date.now()}`

try {
  git(['worktree', 'add', '--detach', work])
  git(['checkout', '--orphan', staging], { cwd: work })
  try {
    git(['rm', '-rq', '--cached', '.'], { cwd: work })
  } catch {}

  for (const entry of fs.readdirSync(work)) {
    if (entry === '.git') continue
    fs.rmSync(path.join(work, entry), { recursive: true, force: true })
  }
  fs.cpSync(DIST, work, { recursive: true })

  git(['add', '-A'], { cwd: work })
  git(['commit', '-q', '-m', `Publish build ${head}.`], { cwd: work })
  git(['push', '-f', 'origin', `HEAD:${BRANCH}`], { cwd: work })
  console.log(`published ${head} to ${BRANCH}`)
} finally {
  try {
    git(['worktree', 'remove', work, '--force'])
  } catch {}
  git(['worktree', 'prune'])
  try {
    git(['branch', '-D', staging])
  } catch {}
}

console.log('Pages will rebuild automatically; force one with:')
console.log('  gh api -X POST repos/0908Joker/joker-ads/pages/builds')
