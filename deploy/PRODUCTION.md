# 唯一生产环境与发布记录

## 永久规则

用户于 2026-09-29 确认：**唯一永久生产环境只部署在自有服务器上，所有曾经的旧生产环境取消。以服务器运行版本为事实基准。**

- 唯一生产服务器：`AllenWebAds-001`（RAKsmart 服务 436567）。
- 主站：`https://b12sl5x.cn/`，服务器 IP `107.149.129.35`，目录 `/www/wwwroot/b12sl5x.cn`。
- 落地页：`http://okqpkdj.cn/`，同机 IP `107.149.129.200`，目录 `/www/wwwroot/okqpkdj.cn`。
- 广告后台和身份卡服务：`/opt/ads-king/admin`；运行时站点数据 `/opt/ads-king/site-data`。
- GitHub 只保存代码、部署工具和变更记录。GitHub Pages、Cloudflare Pages 不再是生产或备用生产的发布目标。
- 不用较旧的仓库源码构建覆盖服务器现有身份卡、邀请码、邀请统计功能。可以基于经过校验的现网产物做可追踪修改；不再把找到原发布电脑作为实施前置条件。
- 旧入口停用以实际下线、DNS 切换或只保留兼容跳转为准，不能仅凭修改文档宣称完成。

## 2026-09-29 现网基线

服务器直接校验与公开 HTTP 下载结果一致：

| 文件 | SHA-256 |
| --- | --- |
| `index.html` | `8c63997a93e532dbd1f81cb678701f9c99ceebc42321969d36ab0cc91faa2e3a` |
| `assets/index-BJq_-mQY.js` | `6641b7b64eab3b0a262554ef1c427170f09d316cc8615b564ec29cc4a4be9f40` |

这份服务器程序已经含有身份卡、二维码、复制和保存图片、`inviteCode`、邀请统计和 `/api/public/customers/claim`，身份在主站域名下使用原有本地存储及后台数据。仓库历史 `main` 的 Vue 源码不等同于此线上版本。

本次从现网产物生成差异，不迁移数据库，也不重新生成既有客户身份。`patch-production-nav.py` 只允许在上述精确基线上执行，修改后反向还原并与原始字节比较，确保没有顺带改写身份卡及邀请代码。

## 删除旧底栏入口

本次改动：

1. 清理内置默认菜单中的「得污」。
2. 删除自动补入旧入口的逻辑，并过滤遗留 `invite`、`home` 项。
3. 保留「应用、精选、抖阴、我的」四项，沿用原样式等宽排列。
4. 默认首页改为 `/#/appcenter`。
5. 生成新资源文件名，先写资源，再原子替换入口 HTML。原资源保留，便于回滚。

本地隔离验证使用服务器真实 JavaScript/CSS，客户接口只使用测试数据，不向生产发送测试绑定。正常菜单、带 `invite/home` 的遗留菜单、配置请求 503 三种情况均显示四项；375px 宽屏下每项 93.75px。已检查「我的」栏目、身份卡打开和二维码显示。剪贴板及图片下载尚未取得成功回执，不计为已通过。

当前生成资源：`index-nav4-630157cd2de0.js`，SHA-256 `630157cd2de02c297976ec12606a635a41959246e00479c9005752a7da784c9e`。

### 发布及回滚

```bash
# 在唯一生产服务器执行，校验不匹配会停止，不覆盖其他版本。
python3 deploy/patch-production-nav.py deploy \
  --site-root /www/wwwroot/b12sl5x.cn \
  --backup-root /opt/ads-king/backups

# 使用该次发布输出的具体备份目录；已有后续发布时会拒绝回滚。
python3 deploy/patch-production-nav.py rollback \
  --site-root /www/wwwroot/b12sl5x.cn \
  --backup-root /opt/ads-king/backups/nav4-<UTC时间>
```

备份保存入口 HTML、完整 assets 目录和发布校验记录。脚本不删除原资源、不改客户数据，也不覆盖后台草稿或在线广告配置。

已于 2026-09-29 01:34:59（新加坡时间；UTC 2026-09-28 17:34:59）上线。服务器备份：`/opt/ads-king/backups/nav4-20260928T173459473329Z`。公开 HTTP 返回的新 JS 与上述哈希一致；生产浏览器显示四项，每项 115px（460px 内容区）。

## 入口迁移到同一服务器

`migrate-production-entry.py` 在上述四项底栏版本上继续修改，不使用历史 Vue 源码重建覆盖生产。

- 正式 H5 地址改为 `https://b12sl5x.cn/h5/`，目录 `/www/wwwroot/b12sl5x.cn/h5`。保留原开屏画面及约两秒时长，以 `location.replace` 进入主站应用中心，并传递 `inviteCode`。
- 落地页「官方入口」进入服务器 H5。传入的邀请码优先；无邀请码时保留原默认值 `1110333149523`。
- 身份卡、邀请分享及二维码共用的新链接为 `http://okqpkdj.cn/?inviteCode=...`。
- 旧 `/#/invite` 与 `/invite` 在初始化客户领取之前跳转到落地页；旧展示组件及独占 CSS、视频引用移除。备份中的原资源保留供回滚。
- 下载页为 `https://b12sl5x.cn/h5/down/`；APK 和 mobileconfig 从旧 H5 原样复制到服务器，二维码同步指向新下载页。没有修改或重新签名安装文件，也没有新增安装后归因。

安装文件内容校验：

`deploy/entry-source.zip` 保存这次从公开旧 H5 下载并校验过的两个安装文件、开屏图和 HTML，以及公开前端 JS/CSS/入口 HTML 基线。生产服务器访问旧 H5 下载接口得到 HTTP 403，因此通过仓库传输这份原样备份；脚本逐文件核对固定哈希，不依赖旧站持续可访问。压缩包不含客户数据或访问凭据。`python deploy/verify-bundled-production.py` 可在隔离目录重现本次正式前端，供 CI 检查。

| 文件 | SHA-256 |
| --- | --- |
| `app.apk` | `56dc416de014fdb2f06bdbe7db6a56f1444603343e8edcb24ff1e0c1d317589b` |
| `app.mobileconfig` | `802af6b2d1db4210f72cb01ea493aa15473c6516ead8cae2a80ecf8f7991fe24` |

注意：原签名 mobileconfig 内仍含历史 `https://app.sb28.me/index.html` WebClip 地址。本次仅搬迁下载文件，未改动签名内容；不能把网页入口迁移描述为安装包内全部历史地址也已清理。

检查记录：

- 精确反向还原补丁，与原始 JS 字节比较，确认共享身份卡和 claim/localStorage 实现未被重写；仅替换共用分享 URL。
- `node scripts/verify-production-entry.mjs`：旧链接不启动 claim、邀请码转义和完整传递、默认邀请码、直接 H5 无邀请码、两秒 replace、无旧展示/视频引用均通过。
- `python deploy/test-production-entry.py crawled/_production-entry`：两站入口同时精确回滚；基线不符时不覆盖。
- 最终生成 JS 的本地浏览器检查：正常/遗留/503 配置均四项；身份卡可打开、二维码和新链接可见，复制/保存操作显示成功提示。自动化未取得剪贴板内容和新 PNG 下载回执，不能据此宣称端到端复制/保存已完全验收。
- 使用锁定依赖执行 `npm ci --ignore-scripts`、`npm run build` 成功。此构建只检查仓库历史源码，**不是本次发布产物**；发布的是通过哈希校验的服务器基线补丁。构建有大于 500kB 的 chunk 提示。

发布前先备份主站入口、完整 assets、落地页入口和发布哈希记录；先放入 H5/下载/QR/新 JS/CSS，再切换落地页及主站入口。中途入口切换失败会恢复本次已切换的入口。回滚命令：

```bash
python3 migrate-production-entry.py rollback \
  --site-root /www/wwwroot/b12sl5x.cn \
  --landing-root /www/wwwroot/okqpkdj.cn \
  --backup-root /opt/ads-king/backups/entry-<该次UTC时间>
```

入口迁移已于 2026-09-29 01:50:32（新加坡时间）上线。服务器备份：`/opt/ads-king/backups/entry-20260928T175032509473Z`。执行脚本来自提交 `ce0d930df1c5b8818d861a136160919257cb2fd1`，SHA-256 `2b973b9e3fe458880c6be51100ed30da6b8e02f65e45ce2cc761531eff4dcd09`。

最终 JS：`index-server-46d1d07f01e5.js`（SHA-256 `46d1d07f01e5f8f1589a9deec4460e43f458f28f9f24b00f79bf5d892b831d08`）；CSS：`index-server-4e39b5ffbea0.css`。主站、落地页、H5、下载页、QR、两份安装文件、开屏图及 JS/CSS 共 10 个公开 HTTP 文件全部与本地发布清单哈希一致。浏览器已确认加载最终 JS、四项底栏等宽。

用户随后明确本次剩余范围为“修改 GitHub 仓库的生产部署，然后打包 APK”。域名由其他人管理，DNS / 外部 Pages 停用不再作为本次后续执行事项。下表保留真实状态，不能改写成外部服务已全部取消。新增 Android 工程与签名说明见 [android/README.md](../android/README.md)；新 APK 独立交付，不自动替换落地页原安装文件。

## 旧环境停用清单

| 项目 | 当前亲自核实结果 | 停用状态 |
| --- | --- | --- |
| GitHub Pages 自动发布 | 本分支删除 `pages.yml`；`publish-pages.mjs` 明确拒绝发布；公网旧 Pages 地址当前 301 到主站 | 发布入口已在本分支停用；合并后才作用于默认分支。外部 Pages 服务未确认取消 |
| 旧 `51-pc.com` 发布 | 本分支删除 `deploy.yml`；旧引导脚本退出并说明已废弃 | 仓库入口已停用；不操作其他项目目录 |
| Cloudflare Pages H5 `app.b12sl5x.cn` | DNS 指向 `b12sl5x.pages.dev`；当前提供的令牌对目标 Pages 返回 403 | 尚未停用 |
| 用户标记的 Cloudflare 账户 | 已进入 `Joker870908@gmail.com's Account`，并选择 Pages 筛选；页面显示 `No projects found` | 未找到可停用的目标项目，不能视为已停用 |
| 域名解析 | `b12sl5x.cn` 的权威 NS 为 `ns1.julydns.com` / `ns2.julydns.com`；主域指向服务器，`app` 子域 CNAME 指向旧 Pages | 需要实际域名后台将 `app` 切到服务器，再移除旧 Pages 域名绑定/项目 |

停用前须让服务器接管对应入口和下载资源，保留已有链接的访问能力。Cloudflare 目标项目及其域名管理权限尚未取得时，如实保留此项未完成状态。
