#!/bin/bash
set -euo pipefail

DOMAIN="51-pc.com"
WEB_ROOT="/var/www/${DOMAIN}"
REPO="0908Joker/joker-ads"
TMP="/tmp/joker-ads-deploy"

apt-get update -qq
apt-get install -y -qq nginx git curl

mkdir -p "$WEB_ROOT" "$TMP"
rm -rf "$TMP"/*
git clone --depth 1 "https://github.com/${REPO}.git" "$TMP/repo"
cd "$TMP/repo"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs
npm ci
npm run build
rsync -a --delete dist/ "$WEB_ROOT/"

install -m 644 deploy/nginx-51-pc.conf "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
chown -R www-data:www-data "$WEB_ROOT"
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "Deployed to http://${DOMAIN}/"
