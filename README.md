# joker-ads · 项目全档案

> **唯一永久生产环境：自有 VPS `AllenWebAds-001`，主站 `https://b12sl5x.cn/`。**
> 以服务器正在运行的版本为准。GitHub 负责代码与变更记录；GitHub Pages、Cloudflare Pages 均不再作为生产或备用生产环境。
> 生产目录、现网身份基线、发布记录与旧环境停用进度见 `deploy/PRODUCTION.md`。
> Android 安装包工程、打包与签名方法见 `android/README.md`。APK 直接加载服务器正式站点。

本文件是项目的全量档案：简介、功能、架构、时间线、方向变更、运行方式、CI/CD、坑位与协作规范。
所有条目均取自仓库内的目录、脚本、工作流、规则文件与 git 变更记录；无证据的部分明确标注「暂无登记」。

---

## 1. 项目简介与主要目的

**joker-ads**（`package.json` 中登记名 `ads-king`）是一套「移动端应用中心 / 广告分发站点」的完整实现，包含三层内容：

1. **前端站点**：1:1 复刻 `fbi.xdx794.com/#/appcenter` 的应用中心 UI，采用 Vue 3 + Vite + Vue Router 与 rem 移动端布局，对外域名 `https://b12sl5x.cn/`。
2. **管理后台**：Node 服务（`admin/server.mjs`）+ 独立静态管理界面（`admin/public/`），用于维护站点配置、标签页、弹窗、广告位与应用投放，采用 draft / live 双份 JSON 数据与原子发布。
3. **采集与验证工具链**：`scripts/` 下的爬虫（网络拦截 + DOM 抓取 + 资源落盘）、API 会话同步、审计门禁与发布脚本；产物集中落在 `crawled/`。

配套还有 **Android 壳工程**（`android/`，包名 `cn.b12sl5x.dewu`），把线上站点包进原生 WebView，并附带原生请求策略、URL 策略与单元测试。

**服务对象**：站点运营者（通过管理后台改配置、发广告位、看反馈）与站点访客（浏览应用中心、观看视频、使用充值/支付与广告落地页链路）。项目品牌名为 **得污**。

> 说明：仓库根目录的 `src/`、`scripts/`、`deploy/` 被 `package.json` 与两个 GitHub Actions 工作流大量引用，但未出现在本次档案所提供的目录清单中，其内部文件级结构**暂无登记**，本文按脚本名与工作流调用点描述其职责。

---

## 2. 功能特性清单（模块级）

### 2.1 前端站点

| 能力 | 说明 | 证据 |
|---|---|---|
| 应用中心主界面 | 1:1 复刻原站应用中心，含 精品APP 网格与站长推荐模式 | git：`ec3ae79` Complete 1:1 clone with live API layer and audit gate；`837f6af` Fix empty app grid on 站长推荐 mode；`f894f04` …精品APP grid popup |
| 分类标签页与信息流 | 每个分类 tab 都有独立 feed，视频池预热（baking a video pool）、分类缓存 | git：`22e7e8a` Give every category tab a feed by baking a video pool；`7ced643` featured per-tab cache；`9bf0b44` Match origin video list APIs for 1:1 featured, douyin, and dark tabs |
| 视频播放（HLS） | 播放页 + HLS 支持，请求有界、播放失败归属保留、播放器代次隔离 | `package.json` 依赖 `hls.js`；git：`70d3e58` …play page with HLS support；`1637a9b` fix(media): bound requests and retain playback failure ownership；`d129820` isolate player generations |
| 播放代理 | 因源站 IP 被封，播放走 `al-ads` API 代理，并固定上游 IP、清理重复 CORS | git：`c21f0ea` Route playback through al-ads API proxy to bypass origin IP ban；`da8c878` Pin ads-king API proxy upstream IPs and strip duplicate CORS |
| 广告落地页与点击归因 | 直接打开广告主落地页（而非点击追踪端点），同时完成点击归因与刷新对齐 | git：`4140bd2` Open advertiser landing pages instead of the click-tracking endpoint；`d129820` attribute ad clicks；`0e7c02e` align ad tracking refresh |
| 充值 / 支付 | 接入 Najin 支付通道 8002/8009，QR 弹窗 + VPS BFF，二维码渲染 | `package.json` 依赖 `qrcode`；git：`fae23eb` Wire Najin pay channels 8002/8009 with QR modal and VPS BFF；`ef874a8` Show payment QR by framing the resolved https checkout page；`cbdbdc0` Close payment creation and auth vulnerabilities |
| 我的页面 | 我的页所有控件均有实际行为；应用/头像等元素对齐原站 | git：`239cbbc` Make every control on the mine page do something；`2761c2a` Polish P2 UI gaps: mine apps/avatar… |
| 弹窗序列 | 顺序弹窗（sequential popups）、去掉假弹窗兜底 | git：`eea65a6` …sequential popups…；`9dc35bb` …remove fake popup fallback；`12e7c44` Fix fake VIP popup overlay on app center |
| 响应式外壳 | 桌面外壳 460px @ 48px rem；移动外壳上限 430px；整宽 rem 布局 | git：`d42abfa` Match origin desktop shell: 460px at 48px rem；`e250630` Cap mobile shell at 430px…；`9dc35bb` Fix full-width rem layout… |

### 2.2 管理后台（`admin/`）

| 模块 | 职责 | 证据 |
|---|---|---|
| HTTP 服务 | 管理后台服务入口 | `admin/server.mjs` |
| 认证 | 登录会话与权限；TOTP 二次验证；默认引导口令被拒 | `admin/lib/auth.mjs`、`admin/lib/totp.mjs`；git：`e70b553` reject default bootstrap credentials |
| API 会话 | 后台对上游 API 的会话处理 | `admin/lib/apiSession.mjs` |
| 站点配置模型 | config / meta / tabs / popups 四类数据，draft 与 live 双份 | `admin/data/draft/{config,meta,tabs,popups}.json`、`admin/data/live/{config,meta,tabs,popups}.json` |
| 配置校验 | 发布
