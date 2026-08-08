#!/bin/bash
set -euo pipefail

DOMAIN="51-pc.com"
WEB_ROOT="/var/www/${DOMAIN}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

apt-get update -qq
apt-get install -y -qq nginx

mkdir -p "$WEB_ROOT"
chown -R www-data:www-data /var/www

if [ -f "/tmp/nginx-51-pc.conf" ]; then
  cp /tmp/nginx-51-pc.conf "$NGINX_CONF"
  ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable nginx
systemctl reload nginx

echo "OK: nginx ready at ${WEB_ROOT}"
