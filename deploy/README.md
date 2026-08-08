# Deploy

## DNS (Cloudflare)

Point A record to server IP:

| Type | Name | Content |
|------|------|---------|
| A | `@` | `107.149.129.35` |
| CNAME | `www` | `51-pc.com` |

Proxy (orange cloud) can stay on.

## Manual deploy

```bash
npm run build
sshpass -p 'YOUR_PASSWORD' rsync -avz --delete dist/ root@107.149.129.35:/var/www/51-pc.com/
```

## GitHub Actions

Set repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PASSWORD`, then push to `main` or run workflow manually.
