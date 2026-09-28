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

实际生产发布时间、备份位置和线上核验将在执行后补记；以上本地检查不代表已经上线。

## 旧环境停用清单

| 项目 | 当前亲自核实结果 | 停用状态 |
| --- | --- | --- |
| GitHub Pages 自动发布 | 仓库仍有 `pages.yml` 和 `publish-pages.mjs` 历史发布通道 | 正在停用 |
| 旧 `51-pc.com` 发布 | `deploy.yml` 和旧引导脚本仍引用已废弃目录；旧文档已说明该方案废弃 | 正在停用仓库入口；不得误操作其他项目 |
| Cloudflare Pages H5 `app.b12sl5x.cn` | DNS 指向 `b12sl5x.pages.dev`；当前提供的令牌对目标 Pages 返回 403 | 尚未停用 |
| 用户标记的 Cloudflare 账户 | 已进入 `Joker870908@gmail.com's Account`，并选择 Pages 筛选；页面显示 `No projects found` | 未找到可停用的目标项目，不能视为已停用 |

停用前须让服务器接管对应入口和下载资源，保留已有链接的访问能力。Cloudflare 目标项目及其域名管理权限尚未取得时，如实保留此项未完成状态。
