# 部署与基础设施

> 最后核对：2026-08-26（对照线上实际状态逐项验证）

## 架构现状

前端和后端**分在两个地方**，这一点容易搞混：

| 组件 | 域名 | 托管在哪 | 怎么发布 |
|------|------|----------|----------|
| 前端站点 | `b12sl5x.cn` | **GitHub Pages** | push `main` → Actions 自动构建部署 |
| 接口 / 支付 | `al-ads.com` | **自有服务器** `107.149.129.35` | ssh 上去改，手动 reload |

也就是说：**前端目前仍然依赖 GitHub**，服务器只承载后端服务。想彻底脱离 GitHub 需要做前端迁移（见文末）。

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

### 发布

```bash
npm run build
git push origin main      # 触发 GitHub Actions → Pages
```

确认线上拿到新版本（比对构建产物文件名）：

```bash
ls dist/assets/index-*.js
curl -s "https://b12sl5x.cn/index.html?cb=$RANDOM" | grep -o 'index-[A-Za-z0-9_-]*\.js'
```

两边一致才算部署完成。查部署状态：

```bash
gh run list --limit 3 --workflow "Deploy to GitHub Pages"
```

如果任务长时间 `queued` 且 `gh run view <id>` 看不到 JOBS，多半是 GitHub 侧故障，查 <https://www.githubstatus.com/api/v2/summary.json>。

---

## 如果要把前端也迁到服务器

目前**没做**。真要脱离 GitHub，需要这四步：

1. 在服务器上建 `b12sl5x.cn` 的 vhost，根目录放 `dist/`
2. 把 `b12sl5x.cn` 的 DNS 从 GitHub Pages 的四个 IP 改指到 `107.149.129.35`
3. 给 `b12sl5x.cn` 申请 SSL 证书（服务器上现有证书只覆盖 `seduoduo.cc` / `seduoduo.cn` / `shibopay.net`，没有这个域名）
4. 发布方式改成 `rsync dist/` 上传

DNS 和证书这两步有生效窗口，切换期间站点可能短暂不可用，要挑时间做。

---

## 遗留文件

以下是早期 `51-pc.com` 方案的残留，**与当前架构无关**，不要照着执行：

- `deploy/api-proxy.js` — Cloudflare Worker 版代理，现已改用服务器 nginx
- `deploy/nginx-51-pc.conf`、`deploy/setup-server.sh`、`deploy/bootstrap.sh` — 针对已废弃的 `51-pc.com`
