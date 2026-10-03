#!/usr/bin/env bash
# Installed once as a root-owned forced SSH command. This key has no shell,
# PTY, port/agent forwarding or arbitrary deployment destination.
set -euo pipefail
revision=${SSH_ORIGINAL_COMMAND:-}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 64
exec 9>/run/lock/joker-ads-ci-deploy.lock
flock -n 9 || exit 75
head_sha=$(git ls-remote https://github.com/0908Joker/joker-ads.git refs/heads/main | cut -f1)
test "$revision" = "$head_sha"
release="/opt/ads-king/releases/ci-$revision"
mkdir -p "$release"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  "https://api.github.com/repos/0908Joker/joker-ads/tarball/$revision" -o "$release/source.tar.gz"
prefix=$(tar -tzf "$release/source.tar.gz" | head -1 | cut -d/ -f1) || true
[[ "$prefix" =~ ^0908Joker-joker-ads-[a-f0-9]+$ ]]
tar -xzf "$release/source.tar.gz" --strip-components=1 -C "$release" \
  "$prefix/deploy/deploy-ad-sync.mjs" "$prefix/admin/lib/appPlacements.mjs" "$prefix/scripts/test-ad-sync.mjs"
node "$release/deploy/deploy-ad-sync.mjs" --deploy "$revision"
