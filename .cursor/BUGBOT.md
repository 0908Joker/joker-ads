# Bugbot rules — joker-ads

This is a T2 Vue/Vite static site with a crawler, API snapshots, a Cloudflare proxy,
GitHub Pages, and an optional VPS path. Focus on user-visible correctness, data
integrity, and release/security defects rather than style.

## Business invariants

1. Application cards and feed entries must keep stable identity, ordering, labels,
   icons, and destination URLs across API normalization and generated snapshots.
   A fallback must not redirect an item to a different application or category.
2. Crawler and sync retries must be bounded and idempotent. Empty, unauthorized,
   partial, challenge, or error responses must not replace a known-good snapshot.
3. Mobile hash routes such as `#/appcenter` must remain directly loadable and must
   not depend on server-side history fallback.
4. API proxy/decryption failures must fail visibly or use an explicitly safe static
   fallback; they must not expose upstream payloads, authorization material, or
   falsely present stale/failed data as live success.
5. GitHub Pages, custom domains, Cloudflare Worker routes, and VPS deployment are
   production surfaces. Workflow or deployment changes require human approval and
   may not weaken TLS/SSH verification or expose passwords.

## Security and data review

- Flag cookies, authorization headers, API-session credentials, browser profiles,
  deploy passwords, Cloudflare credentials, private keys, or real user data in code,
  JSON snapshots, crawler output, workflow logs, docs, and fixtures.
- Pay special attention to `src/data/api-session.json`, `src/api/decrypt.js`,
  `src/api/client.js`, `scripts/*session*`, `.github/workflows/**`, and `deploy/**`.
- External HTML/API data is untrusted input. Prevent script injection, unsafe URLs,
  path traversal, and unbounded resource downloads.

## Noise controls

- Do not report intentional visual differences from the reference site unless they
  break the documented route, interaction, data, or responsive behavior.
- Do not flag generated files solely for being large; flag unexplained regeneration,
  credential leakage, partial data, unstable ordering, or source/output mismatch.
