# 部署与基础设施

> 最后核对：2026-08-26（对照线上实际状态逐项验证）

## 架构现状

前端和后端**分在两个地方**，这一点容易搞混：

| 组件 | 域名 | 托管在哪 | 怎么发布 |
|------|------|----------|----------|
| 前端站点 | `b12sl5x.cn` | **GitHub Pages**（`gh-pages` 分支，迁移中） | `npm run publish` |
| 接口 / 支付 | `al-ads.com` | **自有服务器** `107.149.129.35` | ssh 上去改，手动 reload |

也就是说：**前端目前仍然依赖 GitHub**，服务器只承载后端服务。迁移已在进行，服务器端就绪，等 DNS 切换。

验证方法：

```bash
curl -sI https://b12sl5x.cn/ | grep -i server   # Server: GitHub.com
nslookup b12sl5x.cn                             # 185.199.108-111.153（GitHub Pages）
nslookup al-ads.com                             # 107.149.129.35（自有服务器）
```

---

## 服务器

```
IP    107.149.129.35
SSH   端口 32356，密钥登录（密码登录关闭）
用户  root
```

```bash
ssh -p 32356 -i ~/.ssh/cr7_local_workstation_ed25519 root@107.149.129.35
```

面板是宝塔，nginx 配置在 `/www/server/`，站点根目录在 `/www/wwwroot/`。

### 重要：al-ads.com 不是我们的站

`/www/wwwroot/al-ads.com` 下跑的是**另一套 PHP 广告联盟系统**（adnet），与本项目无关。我们只是在它的 nginx vhost 上追加了几个 `location` 块来提供接口代理。

**不要动那个目录下的任何文件。**

### 我们在服务器上的东西

| 路径 | 用途 |
|------|------|
| `/www/server/panel/vhost/nginx/extension/seduoduo.cc/ads-king-proxy.conf` | 三个 location：`/api-proxy/`、`/m3u8-proxy`、`/pay-bff/` |
| `/www/server/nginx/conf/ads-king-upstream.conf` | 固定上游 CDN 节点 IP |
| `/opt/ads-king/najin-pay-bff.mjs` | 纳金支付后端服务 |
| `/etc/ads-king/najin-pay.env` | 支付密钥等环境变量，权限 0600 |
| `/etc/systemd/system/najin-pay.service` | 支付服务的 systemd 单元 |

vhost 文件是 `/www/server/panel/vhost/nginx/seduoduo.cc.conf`，其中 `server_name al-ads.com`，通过 `include extension/seduoduo.cc/*.conf` 把我们的片段引进去。

---

## 三个后端服务

### 1. API 代理 `/api-proxy/`

把 `https://al-ads.com/api-proxy/<path>` 转发到 `https://deuwy.jcd9nw.com/api/v1/<path>`。

存在的理由，每条都是踩过的坑：

- **原站按客户端 IP 封禁**（`errorCode 1067 此ip已经禁止登陆`），所以必须把 `X-Forwarded-For` 和 `X-Real-IP` 置空，让请求以服务器的干净 IP 出去。
- **上游会自己带 CORS 头**，和 nginx 加的那份重复，浏览器遇到重复的 `Access-Control-Allow-Origin` 会直接拒绝整个请求。所以要先 `proxy_hide_header` 把上游那份藏掉，再由 nginx 加一份。
- **CDN 的 DNS 会返回失效节点**，所以上游 IP 在 `ads-king-upstream.conf` 里写死。

### 2. 媒体代理 `/m3u8-proxy?url=<encoded>`

HLS 播放流转发，同样清掉客户端 IP、统一 CORS。

### 3. 支付 BFF `/pay-bff/`

反向代理到 `127.0.0.1:8787`，由 systemd 服务 `najin-pay` 提供。

```bash
systemctl status najin-pay
systemctl restart najin-pay
journalctl -u najin-pay -f
curl -s https://al-ads.com/pay-bff/health     # {"ok":true,"mchId":10028}
```

接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/pay-bff/health` | 存活检查 |
| POST | `/pay-bff/create` | 下单，返回二维码收银台地址 |
| GET | `/pay-bff/query?mchOrderNo=` | 查订单支付状态 |
| POST | `/pay-bff/notify` | 接收支付回调 |

纳金通道：

| 通道 | 编码 | 金额范围 |
|------|------|----------|
| 微信原生纯视频 | 8002 | ¥30–500 |
| 支付宝原生纯视频 | 8009 | ¥10–500 |

**为什么必须放服务端**：签名要用商户密钥，密钥绝不能进前端代码或仓库。它只存在于服务器的 `/etc/ads-king/najin-pay.env`，仓库里只有不含真值的 `najin-pay.env.example`。

**为什么要在服务端跟跳转**：网关返回的 `payUrl` 是个 **http** 中转页，要靠 JS 连跳两次才到真正的 **https** 收银台。前端直接 iframe 那个 http 地址会被浏览器当混合内容拦掉（白屏）。所以 BFF 在服务端把跳转链跟完，把最后的 https 地址作为 `payPageUrl` 返回给前端去嵌。

### 更新 BFF 代码

```bash
scp -P 32356 -i ~/.ssh/cr7_local_workstation_ed25519 \
  deploy/najin-pay-bff.mjs root@107.149.129.35:/opt/ads-king/
ssh -p 32356 -i ~/.ssh/cr7_local_workstation_ed25519 root@107.149.129.35 \
  "systemctl restart najin-pay && systemctl is-active najin-pay"
```

### 更新 nginx 配置

```bash
scp -P 32356 -i ~/.ssh/cr7_local_workstation_ed25519 deploy/ads-king-proxy.conf \
  root@107.149.129.35:/www/server/panel/vhost/nginx/extension/seduoduo.cc/
ssh -p 32356 -i ~/.ssh/cr7_local_workstation_ed25519 root@107.149.129.35 \
  "nginx -t && nginx -s reload"
```

改之前先备份，目录里已经有几个 `.bak.*` 就是这么来的。

---

## 前端

### 环境变量

`.env.production`：

```
VITE_API_PROXY_ORIGIN=https://al-ads.com
VITE_PAY_BFF_ORIGIN=https://al-ads.com
```

本地 `npm run dev` 走 Vite 的 `/api-proxy` 转发，不需要这两个变量。

### 视频数据

分类 Tab 的内容来自烘焙数据 `src/data/video-pool.json`，**不是**实时接口。

原因：原站的 `categories/{id}`、`tag/videos/name`、`videos/filter` 对我们的 token 一律返回 0 条，只有 `videos/recommend` 还能分页取数。所以采集 recommend 的分页结果存成池子，前端按 Tab 和子 Tab 切片，保证每个 Tab 都有内容且互不重复。

刷新数据：

```bash
node scripts/sync-video-pool.mjs
```

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `MAX_PAGES` | 80 | 最多翻多少页；实测翻到 500 页仍有新内容 |
| `POOL_MAX` | 1200 | 保留条数，即 14 Tab × 3 子 Tab × 24 条 |

池子会打成独立 chunk 异步加载，别把它 `import` 进主包——1200 条约 316 KB，直接内联会让首屏包翻倍。

### 发布

Pages 的来源是 **`gh-pages` 分支**（`build_type=legacy`），**不是** Actions 工作流。所以：

> **推 `main` 不会部署任何东西**，必须跑发布命令。

```bash
npm run publish     # 构建 + 推 gh-pages + 触发 Pages 重建
```

为什么这么改：2026-08-26 GitHub Actions 发生 major outage，部署任务排队一个多小时没有 runner 接手，而 Pages 组件本身是正常的。分支部署走 GitHub 自己的 Pages 构建器，不依赖 Actions runner，所以能绕过这类故障。

`.github/workflows/` 里的 `pages.yml` 现在是**空转**的，留着以备将来切回 Actions 模式。

确认线上拿到新版本（比对构建产物文件名）：

```bash
ls dist/assets/index-*.js
curl -s "https://b12sl5x.cn/index.html?cb=$RANDOM" | grep -o 'index-[A-Za-z0-9_-]*\.js'
```

两边一致才算部署完成。查构建状态：

```bash
gh api repos/0908Joker/joker-ads/pages/builds/latest --jq '{status, error: .error.message}'
gh api -X POST repos/0908Joker/joker-ads/pages/builds    # 手动触发
```

当前 Pages 配置：

```bash
gh api repos/0908Joker/joker-ads/pages --jq '{build_type, source, https_enforced, cert: .https_certificate.state}'
# {"build_type":"legacy","source":{"branch":"gh-pages","path":"/"},"https_enforced":true,"cert":"approved"}
```

如果任务长时间 `queued` 且 `gh run view <id>` 看不到 JOBS，多半是 GitHub 侧故障，查 <https://www.githubstatus.com/api/v2/summary.json>。

---

## 前端迁移到服务器（进行中）

服务器端**已经搭好并验证通过**，只差 DNS 和证书。

已完成：

- 站点根目录 `/www/wwwroot/b12sl5x.cn`，`dist/` 已上传
- vhost `/www/server/panel/vhost/nginx/b12sl5x.cn.conf`（仓库副本：`deploy/b12sl5x.cn.conf`）
- SPA 深链回退、资源长缓存、`index.html` 禁缓存、gzip
- 同源挂载了 `/api-proxy/`、`/m3u8-proxy`、`/pay-bff/`

绕过 DNS 直接验证：

```bash
curl -s -H "Host: b12sl5x.cn" http://107.149.129.35/ | grep -o '<title>.*</title>'
curl -s -H "Host: b12sl5x.cn" http://107.149.129.35/pay-bff/health
```

### 剩余步骤

1. **改 DNS**：把 `b12sl5x.cn` 的 A 记录从 GitHub Pages 那四个 IP（`185.199.108-111.153`）改成 `107.149.129.35`，必须**灰云 / 仅 DNS**，开代理会挡掉证书验证。
2. **签证书**（DNS 生效后执行）：

```bash
certbot certonly --webroot -w /www/wwwroot/b12sl5x.cn \
  -d b12sl5x.cn -d www.b12sl5x.cn --agree-tos -m <邮箱> -n
```

3. **开 HTTPS**：在 vhost 里加 `listen 443 ssl`、证书路径和 HTTP 跳转（可参照 `seduoduo.cc.conf` 的 SSL 段），然后 `nginx -t && nginx -s reload`。

### 更新站点内容

```bash
npm run build
scp -P 32356 -i ~/.ssh/cr7_local_workstation_ed25519 -r dist/* \
  root@107.149.129.35:/www/wwwroot/b12sl5x.cn/
```

`dist/` 有近 700 个小文件，scp 逐个传要十几分钟。文件多时改用打包传输更快：

```bash
tar czf - -C dist . | ssh -p 32356 -i ~/.ssh/cr7_local_workstation_ed25519 \
  root@107.149.129.35 "tar xzf - -C /www/wwwroot/b12sl5x.cn"
```

传完记得 `chown -R www:www /www/wwwroot/b12sl5x.cn`。

---

## 遗留文件

以下是早期 `51-pc.com` 方案的残留，**与当前架构无关**，不要照着执行：

- `deploy/api-proxy.js` — Cloudflare Worker 版代理，现已改用服务器 nginx
- `deploy/nginx-51-pc.conf`、`deploy/setup-server.sh`、`deploy/bootstrap.sh` — 针对已废弃的 `51-pc.com`
