# Deploy to 51-pc.com

## 当前状态

- **GitHub Pages 已部署**：https://0908joker.github.io/joker-ads/
- **自定义域名已绑定**：51-pc.com（GitHub 侧）
- **Cloudflare DNS 需修改**（目前 A 记录指向 `108.187.7.53`，导致 522）

### Cloudflare DNS 改法（二选一）

**方案 A — 走 GitHub Pages（推荐，已就绪）**

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| CNAME | `@` | `0908joker.github.io` | 仅 DNS（灰云） |
| CNAME | `www` | `0908joker.github.io` | 仅 DNS（灰云） |

**方案 B — 走 VPS `107.149.129.35`**

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| A | `@` | `107.149.129.35` | 可开代理 |
| CNAME | `www` | `51-pc.com` | 可开代理 |

VPS 需在安全组放行 **22/SSH**，然后在 VNC 控制台执行：

```bash
curl -fsSL https://raw.githubusercontent.com/0908Joker/joker-ads/main/deploy/bootstrap.sh | bash
```

## Manual deploy (SSH 可用后)

```bash
npm run build
sshpass -p 'YOUR_PASSWORD' rsync -avz --delete dist/ root@107.149.129.35:/var/www/51-pc.com/
```

## GitHub Actions

- `Deploy to GitHub Pages`：push 到 main 自动部署
- `Deploy to VPS`：手动触发（需 SSH 22 端口开放）
