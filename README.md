# joker-ads · 项目全档案

> **唯一永久生产环境：自有 VPS `AllenWebAds-001`，主站 `https://b12sl5x.cn/`。**
> 以服务器正在运行的版本为准。GitHub 负责代码与变更记录；GitHub Pages、Cloudflare Pages 均不再作为生产或备用生产环境。
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
| 业务 TG 入口 | 站点携带业务 Telegram 链接 | git：`505cd35` Ship play/search/douyin hardening, admin panel, and business TG link |

### 2.2 管理后台（`admin/`）

| 模块 | 职责 | 证据 |
|---|---|---|
| HTTP 服务 | 管理后台服务入口 | `admin/server.mjs` |
| 认证 | 登录会话与权限；TOTP 二次验证；拒绝默认引导口令 | `admin/lib/auth.mjs`、`admin/lib/totp.mjs`；git：`e70b553` reject default bootstrap credentials |
| API 会话 | 后台对上游 API 的会话处理；允许 `sid` 请求头通过 CORS | `admin/lib/apiSession.mjs`；git：`445fdab` Allow the sid header through CORS so API calls work again |
| 站点配置模型 | config / meta / tabs / popups 四类数据，draft 与 live 双份 | `admin/data/draft/{config,meta,tabs,popups}.json`、`admin/data/live/{config,meta,tabs,popups}.json` |
| 配置校验 | 发布前对配置做结构与取值校验 | `admin/lib/configValidation.mjs` |
| 原子发布 | 经校验的站点包原子发布，配置变更同步已打开的前端页面 | git：`a7f508f` Atomically publish validated site bundles and wire configured ad slots；`f1b8653` publish admin changes and sync open frontend pages |
| JSON 存储 | 本地 JSON 文件持久化层 | `admin/lib/jsonStore.mjs`、`admin/lib/db.mjs`、`admin/lib/paths.mjs` |
| 广告位与应用投放 | 广告位槽位定义与应用投放位置管理 | `admin/schema/slots.json`、`admin/lib/appPlacements.mjs` |
| 客户端管理 | 客户（customer）数据管理 | `admin/lib/customers.mjs` |
| 管理界面 | 独立静态后台 UI（html/css/js） | `admin/public/index.html`、`admin/public/admin.css`、`admin/public/admin.js`、`admin/public/_style-source.html`、`admin/public/brand/logo.png` |
| 用户初始化脚本 | 设置后台用户 | `admin/scripts/set-users.mjs` |

### 2.3 采集与工具链

| 能力 | 说明 | 证据 |
|---|---|---|
| 爬虫流水线 | 分阶段抓取 + finalize，产物落 `crawled/` | `package.json` `crawl` 脚本调用 `crawl.mjs`、`crawl-phase2.mjs`、`finalize.mjs` |
| API 采集产物 | 事件上报、活动、用户、视频等接口响应抓取归档 | `crawled/api/api/**`（如 `eventTracking/batchReport.json_*.json`、`v1/videos/shortAndImg_*.json`）；`crawled/api-tree.json`、`crawled/api/in-page/browser-api.json` |
| 应用/路由清单 | 已导出应用、完整应用列表、应用内路由、链接清单 | `crawled/apps-exported.json`、`crawled/apps-full.json`、`crawled/app-internal-routes.json`、`crawled/app-links-full.json`、`crawled/app-links-retry.json`、`crawled/category-apps.json` |
| 审计产物 | 审计报告、门禁结果、精选直播审计 | `crawled/audit-report.json`、`crawled/audit-gate.json`、`crawled/audit-featured-live.json` |
| 资源落盘 | 抓取的二进制/图片/HTML/APK 与封面 | `crawled/assets/**`、`crawled/covers/**` |
| API 会话同步 | 同步 API 会话与线上 API | `package.json` `sync:api` 脚本调用 `sync-api-session.mjs`、`sync-live-api.mjs` |
| 审计门禁 | 审计门禁脚本 | `package.json` `audit:gate` 脚本调用 `audit-gate.mjs` |
| 发布脚本 | VPS 发布与 Pages 发布（Pages 已停用） | `package.json` `publish` → `scripts/publish-vps.mjs`；`publish:pages` → `scripts/publish-pages.mjs` |
| 站点数据种子 | 生成站点种子数据 | `package.json` `seed:site-data` → `scripts/seed-site-data.mjs` |

### 2.4 Android 壳工程（`android/`）

| 模块 | 说明 | 证据 |
|---|---|---|
| WebView 主界面 | 加载线上站点的原生界面 | `android/app/src/main/java/cn/b12sl5x/dewu/MainActivity.java` |
| 原生请求策略 | 请求策略控制与单元测试 | `android/app/src/main/java/cn/b12sl5x/dewu/NativeRequestPolicy.java`、`android/app/src/test/java/cn/b12sl5x/dewu/NativeRequestPolicyTest.java` |
| URL 策略 | URL 白名单/放行策略与单元测试 | `android/app/src/main/java/cn/b12sl5x/dewu/UrlPolicy.java`、`android/app/src/test/java/cn/b12sl5x/dewu/UrlPolicyTest.java` |
| 原生桥脚本 | 注入 WebView 的桥接脚本 | `android/app/src/main/assets/native-bridge.js` |
| 网络安全配置 | 明文/域名网络安全策略 | `android/app/src/main/res/xml/network_security_config.xml` |
| 数据提取规则 | 备份/提取规则 | `android/app/src/main/res/xml/data_extraction_rules.xml` |
| 应用信息与主题 | 包名、字符串、主题、图标 | `AndroidManifest.xml`、`strings.xml`、`styles.xml`、`drawable/app_icon.png` |
| 构建配置 | Gradle 应用与根构建、wrapper | `android/app/build.gradle`、`android/build.gradle`、`android/settings.gradle`、`android/gradle.properties`、`android/gradle/wrapper/*`、`android/gradlew*` |
| 工程说明 | Android 打包与签名方法 | `android/README.md` |

---

## 3. 架构与技术栈

### 3.1 技术栈

| 层 | 技术 | 证据 |
|---|---|---|
| 前端框架 | Vue 3、Vue Router | `package.json` `vue ^3.5.13`、`vue-router ^4.5.0` |
| 构建 | Vite 6、`@vitejs/plugin-vue` | `package.json` `vite ^6.0.7`、`@vitejs/plugin-vue ^5.2.1` |
| 视频播放 | hls.js | `package.json` `hls.js ^1.7.1` |
| 二维码 | qrcode | `package.json` `qrcode 1.5.4` |
| 加密/压缩工具 | crypto-js、pako | `package.json` `crypto-js ^4.2.0`、`pako ^3.0.1` |
| 管理后台运行时 | Node（ESM，`type: module`）+ 原生 HTTP 服务 | `package.json` `type: module`、`admin/server.mjs` |
| 管理后台依赖 | 见 `admin/package.json`（独立 lockfile） | `admin/package.json`、`admin/package-lock.json` |
| Android | Java + Gradle 8.11.1、Temurin JDK 17 | `verify.yml`（`gradle-version: '8.11.1'`、`java-version: '17'`） |

### 3.2 组件与数据流

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  前端站点 (Vue 3 + Vite)      │        │  Android 壳 (WebView)         │
│  https://b12sl5x.cn/          │◀──────▶│  cn.b12sl5x.dewu              │
└──────────────┬───────────────┘        └──────────────────────────────┘
               │ 读 live 配置 / 广告位
               ▼
┌──────────────────────────────┐
│  管理后台 (admin/server.mjs)  │
│  - auth.mjs / totp.mjs        │
│  - configValidation.mjs       │
│  - appPlacements / slots.json │
│  - apiSession.mjs             │
└──────────────┬───────────────┘
               │ draft → 校验 → 原子发布 → live
               ▼
      admin/data/draft/*.json
      admin/data/live/*.json
               │
               ▼
┌──────────────────────────────┐
│  上游 API / 播放代理 al-ads   │
└──────────────────────────────┘

采集侧：scripts/crawl*.mjs → crawled/{api,assets,covers,*.json}
发布侧：scripts/publish-vps.mjs（+ deploy/verify-bundled-production.py 校验）→ VPS
```

- **配置数据流**：运营在管理后台编辑 `admin/data/draft/{config,meta,tabs,popups}.json`；发布时经 `admin/lib/configValidation.mjs` 校验，再原子写入 `admin/data/live/*.json`（git `a7f508f`），并同步已打开的前端页面（git `f1b8653`）。
- **广告位数据流**：槽位定义在 `admin/schema/slots.json`，应用投放由 `admin/lib/appPlacements.mjs` 解析，前端按配置的广告位渲染（git `a7f508f`「wire configured ad slots」）。
- **认证数据流**：`admin/lib/auth.mjs` 负责会话，`admin/lib/totp.mjs` 负责 TOTP；`admin/lib/apiSession.mjs` 管理上游 API 会话（含 `sid` 头，git `445fdab`）。
- **播放数据流**：前端经 `al-ads` API 代理请求视频（git `c21f0ea`），代理固定上游 IP 并去重 CORS（git `da8c878`）。

### 3.3 目录结构说明

```
.
├─ .env.production                  # 生产环境变量
├─ .github/
│  ├─ copilot-instructions.md       # Copilot 协作说明
│  └─ workflows/{verify,deploy-production}.yml
├─ AGENTS.md                        # AI Agent 中文语言规范（CR7）
├─ admin/                           # 管理后台（Node 服务 + 静态 UI + 数据 + 库）
│  ├─ data/{draft,live}/            # 双份站点配置
│  ├─ lib/                          # auth / totp / 校验 / 存储 / 投放 / 客户 / 会话
│  ├─ public/                       # 管理界面静态资源
│  ├─ schema/slots.json             # 广告位槽位定义
│  ├─ scripts/set-users.mjs         # 用户初始化
│  ├─ server.mjs                    # 服务入口
│  └─ package.json / package-lock.json
├─ android/                         # Android WebView 壳工程（含 README）
├─ crawled/                         # 采集产物：api / assets / covers / 清单 / 审计
├─ src/                             # 前端站点源码（内部结构暂无登记）
├─ scripts/                         # 爬虫 / 同步 / 审计 / 发布脚本（内部结构暂无登记）
├─ deploy/                          # 部署与校验脚本（内部结构暂无登记，已知含 verify-bundled-production.py）
├─ package.json                     # 前端与工具链脚本、依赖
└─ README.md
```

> `src/`、`scripts/`、`deploy/` 在本次档案提供的目录清单中未展开到文件级，其内部结构**暂无登记**；上述职责据 `package.json` 脚本名与工作流调用点归纳。

---

## 4. 里程碑与成长史

时间线按 git 提交顺序（由旧到新）整理，每条对应一次真实提交：

| 阶段 | 提交 | 关键事件 |
|---|---|---|
| 复刻启动 | `12e7c44` → `d42abfa` | 修复应用中心假 VIP 弹窗、去掉假弹窗兜底、整宽 rem 布局、移动/桌面外壳尺寸对齐原站（430px / 460px@48px rem） |
| 1:1 基线与审计 | `ec3ae79`、`eea65a6`、`f894f04`、`65514ef` | 完成 1:1 克隆与 live API 层、审计门禁；顺序弹窗与原站封面；精品APP 网格弹窗；精选视频双列 |
| 对齐与加固 | `9bf0b44`、`cc9e246`、`7ced643`、`2761c2a`、`c21f0ea`、`da8c878`、`b866fd4` | 对齐 featured/douyin/dark 视频接口；P1 圈层/番剧分页/每 tab 缓存；P2 UI 打磨；播放改走 `al-ads` 代理绕开源站 IP 封禁并固定上游 IP；P0 克隆缺口修复 |
| 支付与广告 | `fae23eb`、`ef874a8`、`4140bd2`、`239cbbc`、`4124bc0`、`258a2fa` | 接入 Najin 8002/8009 QR 支付；二维码框选 https checkout；广告直接开落地页；我的页控件全部可用；品牌化「得污」；移除暗黑与圈层模块 |
| 部署迁移 | `fffb6e0`、`750eed3`、`3ba98ee`、`22e7e8a`、`7994300`、`445fdab`、`505cd35` | 修正部署文档；新增前端迁移 vhost；Pages 改为从分支发布；分类 tab feed 与视频池；文档化视频池刷新；`sid` 头 CORS 放行；播放/搜索/抖音加固 + 管理后台 + 业务 TG |
| 生产基线 | `bea3d2d`、`4212a90`、`ce0d930`、`3352412`、`5e7cf6b`、`18480ee`、`108f189` | 迁移到 VPS 生产基线并移除旧导航 tab；保留可复现入口资产；签名服务器 Android 打包 + 生产 CI；发布广告同步补丁；升级 Node 24 / 脱离 Node 20 |
| 安全与稳定性 | `cbdbdc0`、`a7f508f`、`d129820`、`e70b553`、`1637a9b`、`0e7c02e`、`f1b8653` | 修复支付创建与鉴权漏洞 + manifest 校验部署；原子发布校验通过的站点包并接线广告位；广告点击归因、播放器代次隔离、Android 结果回执；拒绝默认引导口令、退役不安全发布；请求有界与播放失败归属；广告刷新对齐；后台变更发布并同步前端 |
| 规范与文档 | `f45cf9a`、`5c17a6f`、`7d9aa95` | AI Agent 中文语言规范；README 全量档案化 |

---

## 5. 方向变更记录（历史设计决策及原因）

| 决策 | 变更内容 | 原因 / 说明 | 证据 |
|---|---|---|---|
| 模块裁剪 | 移除暗黑与圈层模块 | 与最终产品形态不符 | git `258a2fa` Remove the dark and circle modules |
| 品牌更名 | 应用品牌定为「得污」并修复促销 banner | 品牌统一与 UI 修复 | git `4124bc0` |
| 播放链路 | 播放改走 `al-ads` API 代理，固定上游 IP、去重 CORS | 源站对出口 IP 封禁，需代理绕行 | git `c21f0ea`、`da8c878` |
| 广告跳转 | 从「点击追踪端点」改为「直接打开广告主落地页」 | 用户应直接到达落地页，追踪与落地解耦 | git `4140bd2` |
| 发布方式 | GitHub Pages 由 Actions 改为从分支发布；随后整体迁入 VPS 成为唯一生产 | 强化可复现与可控的生产基线 | git `3ba98ee`、`bea3d2d`、`4212a90` |
| 后台发布模型 | 引入校验 + 原子发布 + 前端同步刷新 | 避免半更新/脏配置外泄 | git `a7f508f`、`f1b8653` |
| 安全策略 | 拒绝默认引导口令、退役不安全发布；关闭支付创建与鉴权漏洞；部署加 manifest 校验 | 消除默认凭据与不安全发布面 | git `e70b553`、`cbdbdc0` |
| 构建运行时 | 构建从 Node 20 升级到 Node 24；deploy actions 脱离 Node 20 运行时 | Node 20 已 EOL | git `108f189`、`18480ee` |
| 弹窗策略 | 移除假弹窗兜底，改为顺序展示真实数据 | 假数据造成误导 | git `9dc35bb`、`12e7c44`、`eea65a6` |
| 导航裁剪 | 移除遗留导航 tab | 与 VPS 生产基线对齐 | git `bea3d2d` |
| 遗留发布入口 | `publish:pages` 仍保留在脚本中，但 Pages 不再作为生产 | 历史遗留，以 VPS 为准 | `package.json` `publish:pages`；本文件顶部声明 |

---

## 6. 安装运行与配置项

### 6.1 前端站点

```bash
# 安装（CI 使用 --ignore-scripts）
npm ci --ignore-scripts --no-audit --no-fund

npm run dev      # 本地开发（vite）
npm run build    # 生产构建（vite build）
npm run preview  # 预览构建产物
```

依赖安装来源为 `package.json`；CI 中缓存路径指向 `admin/package-lock.json`，说明管理后台为独立依赖树。

### 6.2 管理后台

```bash
npm run admin:install   # cd admin && npm install
npm run admin:dev       # cd admin && npm run dev
npm run admin:start     # cd admin && npm start
```

后台服务入口 `admin/server.mjs`，运行所需依赖见 `admin/package.json`（独立 lockfile）。用户初始化脚本：`node admin/scripts/set-users.mjs`。

### 6.3 采集 / 同步 / 审计 / 发布脚本

| 命令 | 行为 |
|---|---|
| `npm run crawl` | 依次执行 `crawl.mjs` → `crawl-phase2.mjs` → `finalize.mjs`，产物写入 `crawled/` |
| `npm run sync:api` | 依次执行 `sync-api-session.mjs` → `sync-live-api.mjs` |
| `npm run audit:gate` | 执行 `audit-gate.mjs` 审计门禁 |
| `npm run publish` | 执行 `scripts/publish-vps.mjs` 发布到 VPS |
| `npm run publish:pages` | 执行 `scripts/publish-pages.mjs`（历史入口，Pages 已非生产） |
| `npm run seed:site-data` | 执行 `scripts/seed-site-data.mjs` 生成站点种子数据 |

### 6.4 配置项

| 配置 | 位置 | 说明 |
|---|---|---|
| 生产环境变量 | `.env.production` | 生产构建/运行环境变量（内容未在档案中登记） |
| 站点配置 | `admin/data/{draft,live}/config.json` | 站点主配置 |
| 站点元信息 | `admin/data/{draft,live}/meta.json` | 元信息 |
| 标签页 | `admin/data/{draft,live}/tabs.json` | 分类 tab 定义 |
| 弹窗 | `admin/data/{draft,live}/popups.json` | 顺序弹窗定义 |
| 广告位槽位 | `admin/schema/slots.json` | 广告位 schema |
| 部署凭据 | GitHub Secrets `AD_SYNC_DEPLOY_KEY`、`AD_SYNC_KNOWN_HOSTS` | 受限生产部署密钥与 known_hosts |
| Android 网络策略 | `android/app/src/main/res/xml/network_security_config.xml` | 网络安全配置 |

> `.env.production` 的具体键值、`admin/package.json` 的脚本明细、`config.json`/`meta.json` 的字段定义在本次材料中**暂无登记**。

### 6.5 Android

构建与签名方法见 `android/README.md`。CI 中构建命令：

```bash
gradle -p android --no-daemon assembleRelease assembleDebug testDebugUnitTest lintRelease
```

产物：`android/app/build/outputs/apk/release/app-release-unsigned.apk`、`android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 7. CI/CD 与部署流程

### 7.1 校验工作流 `.github/workflows/verify.yml`

- 名称：`Verify server deployment and APK`；任务名：`SBQB Required Gate`。
- 触发：`pull_request`、`push` 到 `main` 与 `fix/server-nav-four-tabs`、`workflow_dispatch`。
- 权限：`contents: read`。
- 步骤：
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4`（`node-version: '20'`，npm 缓存）
  3. `npm ci --ignore-scripts --no-audit --no-fund`
  4. `npm run build`
  5. `python3 deploy/verify-bundled-production.py`（复现并校验真实 VPS 构建）
  6. `node scripts/verify-android-bridge.mjs`
  7. `actions/setup-java@v4`（Temurin JDK 17）
  8. `gradle/actions/setup-gradle@v4`（Gradle 8.11.1）
  9. `gradle -p android --no-daemon assembleRelease assembleDebug testDebugUnitTest lintRelease`
  10. 上传 `dewu-unsigned-apk`（release unsigned APK）与 `dewu-debug-acceptance-apk`（debug APK），缺失即失败（`if-no-files-found: error`）

### 7.2 生产部署工作流 `.github/workflows/deploy-production.yml`

- 名称：`Deploy verified production release`。
- 触发：`push` 到 `main`（路径过滤：`.github/workflows/deploy-production.yml`、`admin/**`、`src/**`、`scripts/test-*.mjs`、`deploy/**`、`package.json`、`package-lock.json`）与 `workflow_dispatch`。
- 权限：`contents: read`；并发组 `joker-ads-production`，`cancel-in-progress: false`。
- 环境：`production`，`url: https://b12sl5x.cn`；`timeout-minutes: 15`。
- 步骤：
  1. checkout + setup-node（`node-version: '20'`，缓存 `admin/package-lock.json`）
  2. `npm ci --prefix admin --no-audit --no-fund`
  3. `npm ci --ignore-scripts --no-audit --no-fund`
  4. `node scripts/test-audit-security.mjs`（安全与支付隔离回归）
  5. `node scripts/test-ad-sync.mjs`（真实后台增改删/发布 API 演练）
  6. `node scripts/test-audit-config.mjs`（原子快照故障与中断回归）
  7. `python3 deploy/verify-bundled-production.py`（`AUDIT_BUNDLE_OUT=${{ runner.temp }}/audit-release`，复现精确生产构建）
  8. `node scripts/test-audit-runtime.mjs`（播放器竞态回归）
  9. 通过受限生产密钥 SSH 部署：`ssh -i … -p 32356 -o BatchMode=yes -o StrictHostKeyChecking=yes … root@107.149.129.35 "$GITHUB_SHA"`，密钥落 `$RUNNER_TEMP/ad-sync-ssh/`（`umask 077`）
  10. 校验公开部署回执：拉取 `https://b12sl5x.cn/deployment.json`，断言 `status === 'verified'`、`revision === $GITHUB_SHA`，并比对本地 `audit-release/manifest.json` 的前端哈希（片段中为 `receipt.frontendSha256` 与本地 manifest 比较，后续断言行在材料中被截断）

> 部署以「VPS 上正在运行的版本」为准，部署回执 `deployment.json` 作为生产验证凭据。部署主机为 `107.149.129.35`，端口 `32356`。

### 7.3 其他流程

- `.github/copilot-instructions.md`：Copilot 协作说明（内容未在档案中登记）。
- `.github/workflows` 下仅登记 `verify.yml` 与 `deploy-production.yml` 两个工作流。

---

## 8. 注意事项与已知坑

以下均从规则文件、工作流与提交教训中提炼：

1. **默认凭据是红线**：`e70b553` 明确「reject default bootstrap credentials」，部署流程会拒绝默认引导口令，初始化后必须立即更换（涉及 `admin/lib/auth.mjs`、`admin/lib/totp.mjs`）。
2. **发布必须原子且经校验**：`a7f508f`、`f1b8653` 与 `test-audit-config.mjs` 表明配置发布需经过校验、原子写入，并同步已打开页面；直接改 `live/` 会绕过校验。
3. **支付与鉴权属高危区**：`cbdbdc0` 关闭了支付创建与鉴权漏洞；`deploy-production.yml` 中 `test-audit-security.mjs` 专门做支付隔离回归，改动支付链路必须跑通。
4. **播放器代次与请求有界**：`d129820`、`1637a9b` 经验表明播放器需隔离代次、限制请求数量并保留失败归属，否则会出现竞态与请求风暴（`test-audit-runtime.mjs` 覆盖）。
5. **源站 IP 封禁**：播放依赖 `al-ads` 代理并固定上游 IP、去重 CORS（`c21f0ea`、`da8c878`）；改动代理配置需注意 CORS 重复与上游 IP 固定。
6. **`sid` 头 CORS**：`445fdab` 记录此前因 `sid` 头未放行导致 API 调用失败，跨域改动需保留 `sid` 放行。
7. **不要伪造弹窗/兜底数据**：`12e7c44`、`9dc35bb` 记录假 VIP 弹窗与假兜底被移除，回归时不应再引入占位弹窗。
8. **Pages 已非生产**：`3ba98ee` 曾改 Pages 发布方式，`bea3d2d`/`4212a90` 后整体迁入 VPS；`publish:pages` 仅为历史入口，部署以 VPS 与回执为准。
9. **构建运行时升级**：`18480ee`、`108f189` 因 Node 20 EOL 升级；本地与 CI 的 Node 版本需与工作流一致（工作流当前声明 `node-version: '20'`，部署与校验节点均如此）。
10. **抓取产物入仓噪音**：`5faebdb`、`f10c311` 曾将本地审计截图/缓存与浏览器 profile 加入忽略；`crawled/` 下大量 `.bin`/`.apk`/`.ceb`/`.geb` 体积可观，提交前注意 `.gitignore`。
11. **Android 侧**：网络策略在 `network_security_config.xml`，URL/请求策略有单元测试（`UrlPolicyTest`、`NativeRequestPolicyTest`），改策略需同步测试；发布为 unsigned APK 由 CI 产出，签名方式见 `android/README.md`。
12. **部署回执校验**：`deploy-production.yml` 最后一步会校验 `deployment.json` 的 `revision` 与 `status` 以及前端哈希，任何不一致会判定部署失败。

---

## 9. 开发规范与协作约定

### 9.1 语言规范（CR7 统一要求，见 `AGENTS.md`）

所有 AI Agent 在本仓的产出必须使用简体中文：

- PR/Issue 标题与正文、Review 评论、讨论回复
- Commit message
- 代码内新增注释（既有外文注释不强制改）

技术术语可保留英文原词（CI/CD、idempotent 等），句体必须为中文。

### 9.2 提交与分支

- 提交信息采用约定式前缀，历史可见 `fix(config)`、`fix(ui)`、`fix(media)`、`fix(security)`、`fix:`、`chore:`、`docs:` 等。
- 生产部署由 `main` 推送触发（路径过滤），`verify.yml` 额外覆盖分支 `fix/server-nav-four-tabs`。
- 部署与校验工作流均只授予 `contents: read`，遵循最小权限。

### 9.3 变更门禁

- 任何影响 `admin/**`、`src/**`、`scripts/test-*.mjs`、`deploy/**`、`package*.json` 的 `main` 提交都会触发生产部署流水线，须先通过安全、支付隔离、配置原子性、播放器竞态等回归。
- 前端构建与 VPS 构建须可复现：`deploy/verify-bundled-production.py` 在两条流水线中均作为复现与校验步骤。
- 发布后以 `https://b12sl5x.cn/deployment.json` 回执为验收依据。

### 9.4 目录与产物约定

- 采集产物统一落 `crawled/`（`api/`、`assets/`、`covers/` 及顶层清单/审计 JSON），不在源码目录散落。
- 管理后台数据只通过 draft → 校验 → 原子发布链路写入 `live/`。
- 广告位以 `admin/schema/slots.json` 为准，应用投放逻辑集中在 `admin/lib/appPlacements.mjs`。

### 9.5 文档与协作

- 生产环境、发布记录与旧环境停用进度以 `deploy/PRODUCTION.md` 为准（据本文件顶部声明）。
- Android 打包与签名以 `android/README.md` 为准。
- 本 README 为项目全档案，随里程碑与方向变更同步更新。

---

> 未在本次材料中登记的内容：`.github/copilot-instructions.md` 具体条目、`.env.production` 键值、`admin/package.json` 脚本明细、`src/`/`scripts/`/`deploy/` 的文件级结构、`deploy/PRODUCTION.md` 正文、`admin/data/*` JSON 字段定义、部署回执校验脚本被截断的末尾断言。上述部分**暂无登记**，后续以仓库实际文件为准补充。
