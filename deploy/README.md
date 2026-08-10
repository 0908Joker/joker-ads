# Deploy to 51-pc.com

## 当前状态

- **GitHub Pages 已部署**：https://0908joker.github.io/joker-ads/
- **自定义域名已绑定**：51-pc.com（GitHub 侧）
- **Cloudflare DNS**：根域名四条 GitHub 官方 A 记录 + `www` CNAME，全部灰云
- **待完成**：GitHub 签发 HTTPS 证书（DNS 生效后自动进行，通常数分钟到 24 小时）

### Cloudflare DNS（GitHub Pages 官方推荐）

**根域名 `@` — 四条 A 记录（全部灰云 / 仅 DNS）**

| 类型 | 名称 | 内容 |
|------|------|------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**`www` — 一条 CNAME（灰云）**

| 类型 | 名称 | 内容 |
|------|------|------|
| CNAME | `www` | `0908joker.github.io` |

注意：
- **不要**把 `@` 改成 CNAME（当前场景不适用）
- **不要**开橙云代理
- **不要**动 VPS

### HTTPS 证书

DNS 生效后，到 GitHub 仓库 **Settings → Pages → Custom domain** 查看证书状态。
显示绿色勾即完成；若长时间未签发，点 **Remove domain** 再重新 Save 一次可触发重试。

### VPS 备用方案（暂不使用）

VPS IP：`107.149.129.35`。SSH 22 端口当前未开放，需安全组放行后 VNC 执行：

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
