# Agent instructions — joker-ads

## Repository goal and boundary

This repository is a Vue 3/Vite application-center clone plus a Playwright-based
crawler and API snapshot toolchain. The shipped application is static, but its
crawler, Cloudflare API proxy, GitHub Pages release, and optional VPS workflow are
separate trust boundaries.

- Human owner: `@0908Joker`; CR7 is accountable for merge and production approval.
- Risk tier: `T2`. A change involving API sessions, scraped user data, credentials,
  workflows, domains, Cloudflare, VPS, deployment, or production configuration is
  elevated and cannot auto-merge.
- HDXY and sibling repositories are out of scope.

## Architecture entry points

- `src/main.js`, `src/App.vue`, and `src/router/`: application bootstrap and routes.
- `src/views/` and `src/components/`: user-visible pages and shared UI.
- `src/api/`: request, decryption, normalization, and API adapters.
- `src/data/`: versioned public/static snapshots consumed by the UI.
- `scripts/`: crawler, probe, session-sync, data-build, and visual audit tools.
- `deploy/` and `.github/workflows/`: GitHub Pages, Cloudflare/VPS integration,
  and production delivery.

## Install, test, and build

```bash
npm ci
npm run build
```

For a UI/data change, start the built site and run the relevant audit:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
CLONE_URL=http://127.0.0.1:4173 npm run audit:gate
```

Do not run `npm run crawl` or `npm run sync:api` merely to validate an unrelated
change. Those commands contact external systems and may refresh versioned data.

## Minimum verification after a change

- Run `npm run build` for every application or configuration change.
- Smoke the affected hash route and one adjacent route at a mobile viewport.
- For crawler or snapshot changes, verify the smallest representative fixture and
  inspect the resulting diff for credentials, cookies, authorization headers,
  personal data, and unexpectedly broad content changes.
- Workflow/deploy changes require syntax review, a non-production dry run when
  available, and human approval.

## Forbidden and sensitive areas

- Never commit cookies, authorization headers, API-session credentials, browser
  profiles, passwords, private keys, Cloudflare credentials, or real user data.
- `src/data/api-session.json` may contain only intentionally versioned, non-secret
  public metadata. Treat any token-like or session-like field as a security finding.
- Do not weaken TLS or SSH host verification, expose deploy passwords to command
  arguments/logs, or introduce a second ungoverned production path.
- Do not change `.github/workflows/**`, `deploy/**`, API decryption/auth behavior,
  domains, or Cloudflare routes without human review.

## Production and rollback

GitHub Pages and the custom domain are production surfaces. An Agent may create a
Draft PR and non-production evidence, but may not merge, deploy, change a domain or
Worker route, alter repository/Environment settings, or use production credentials.

Rollback application code by reverting the PR and redeploying the previously
verified artifact through the approved GitHub path. Domain, Worker, or VPS rollback
is a separate human-approved operation.

## Code Review Rules

- Preserve stable item identity, ordering, link targets, and route behavior when
  normalizing API and crawler data. Missing fields must not silently map users to a
  different application or destination.
- Decryption and proxy fallbacks must not disable origin validation, leak upstream
  responses, or turn failed/unauthorized responses into trusted cached data.
- Crawler retries must be bounded and must not create duplicate items or overwrite
  a known-good snapshot with an empty/partial result.
- Treat workflow, domain, Cloudflare, VPS, credential, API-session, and external-data
  changes as human-merge even though the repository is T2.
