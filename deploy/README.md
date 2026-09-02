# 部署与基础设施

> 最后核对：2026-08-26（对照线上实际状态逐项验证）

## 架构现状

| 组件 | 域名 | 托管在哪 | 怎么发布 |
|------|------|----------|----------|
| 前端站点 | `b12sl5x.cn` | **自有服务器** `107.149.129.35`（`/www/wwwroot/b12sl5x.cn`） | `npm run publish` |
| 接口 / 支付 | `al-ads.com`（也可同源走站点代理） | **同一台 VPS** | ssh 上去改，手动 reload |
| 代码仓库 | GitHub `0908Joker/joker-ads` | 仅仓库 / 可选备用 Pages | `npm run publish:pages` |

**生产以 VPS 为准。** GitHub Pages 只是备用，不再作为主发布路径。

验证方法：

```bash
# 绕过 DNS，直接验服务器上的站点
curl -s -H "Host: b12sl5x.cn" http://107.149.129.35/ | grep -o 'index-[^"]*\.js'
nslookup b12sl5x.cn          # 应指向 107.149.129.35（DNS 切过去之后）
nslookup al-ads.com          # 107.149.129.35
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

### 发布（主路径 = VPS）

> **推 `main` 不会部署任何东西**，必须跑发布命令。

```bash
npm run publish          # 构建 + 传到 VPS /www/wwwroot/b12sl5x.cn
npm run publish:pages    # 可选：同步一份到 GitHub Pages 备用
```

确认服务器拿到新版本：

```bash
ls dist/assets/index-*.js
curl -s -H "Host: b12sl5x.cn" http://107.149.129.35/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
```

两边文件名一致才算部署完成。

---

## DNS 切到服务器（公网要走 VPS 必须做）

服务器站点与 nginx **已就绪**，最新 `dist` 已上传。公网 `b12sl5x.cn` 若仍解析到 GitHub Pages（`185.199.108-111.153`），浏览器就不会打到这台机。

Nameserver 当前是 `ns1/ns2.julydns.com`（不是 Cloudflare）。

1. **改 DNS**：根域名 `@`（以及 `www`）只留一条 **A → `107.149.129.35`**，删掉 GitHub 那四条 A。
2. **签证书**（DNS 生效后在服务器执行）：

```bash
certbot certonly --webroot -w /www/wwwroot/b12sl5x.cn \
  -d b12sl5x.cn -d www.b12sl5x.cn --agree-tos -m <邮箱> -n
```

3. **开 HTTPS**：在 vhost 里加 `listen 443 ssl`、证书路径和 HTTP→HTTPS 跳转（可参照 `seduoduo.cc.conf`），然后 `nginx -t && nginx -s reload`。

绕过 DNS 直接验证：

```bash
curl -s -H "Host: b12sl5x.cn" http://107.149.129.35/ | grep -o '<title>.*</title>'
curl -s -H "Host: b12sl5x.cn" http://107.149.129.35/pay-bff/health
```

---

## 广告后台 admin.b12sl5x.cn

| 组件 | 路径 / 端口 |
|------|-------------|
| Admin BFF | `/opt/ads-king/admin` · `127.0.0.1:8790` · systemd `ads-king-admin` |
| 运行时 JSON | `/opt/ads-king/site-data/live/{config,popups,tabs,meta}.json` |
| 素材上传 | `/opt/ads-king/uploads/{popups,icons,promo}/` |
| 前台读取 | `https://b12sl5x.cn/data/*.json`（nginx alias，无需 rebuild） |

### 部署

```bash
npm run seed:site-data      # 本地：从 src/data 初始化 admin/data
node scripts/deploy-admin.mjs
npm run publish             # 前台 dist（与后台独立）
```

### DNS

`admin.b12sl5x.cn` A → `107.149.129.35`（与主站相同）。签证书：

```bash
certbot certonly --webroot -w /www/wwwroot/b12sl5x.cn \
  -d admin.b12sl5x.cn --agree-tos -m <邮箱> -n
```

然后在 `deploy/admin.b12sl5x.cn.conf` 加上 443 ssl 段并 reload nginx。

### 默认账号

见 `/etc/ads-king/admin.env`（首次部署从 `deploy/ads-king-admin.env.example` 复制）。**登录后必须改密码。**

### 工作流

1. 登录后台编辑各广告位（保存 = 写 draft）
2. 点「发布到前台」→ 复制 draft → live
3. 用户刷新 `b12sl5x.cn` 即看到更新

---

## 遗留文件

以下是早期 `51-pc.com` 方案的残留，**与当前架构无关**，不要照着执行：

- `deploy/api-proxy.js` — Cloudflare Worker 版代理，现已改用服务器 nginx
- `deploy/nginx-51-pc.conf`、`deploy/setup-server.sh`、`deploy/bootstrap.sh` — 针对已废弃的 `51-pc.com`
