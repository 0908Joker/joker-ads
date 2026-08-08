# joker-ads

1:1 复刻 [fbi.xdx794.com/#/appcenter](https://fbi.xdx794.com/#/appcenter) 的应用中心 UI，含完整爬虫工具链。

## 快速开始

```bash
npm install
npm run dev
# 访问 http://localhost:5173/#/appcenter
```

## 爬虫

```bash
cd scripts
npm install
npx playwright install chromium

# 全量爬取（API + DOM + 资源）
npm run crawl          # Phase 1: 网络拦截
node crawl-phase2.mjs  # Phase 2: DOM + 浏览器内 API
node finalize.mjs      # 整理链接/图标，更新 config.json
node extract-links.mjs # 生成 links-tree.json 层级索引
```

## 输出目录 `crawled/`

| 文件/目录 | 说明 |
|-----------|------|
| `api-tree.json` | 全部 API 请求记录 |
| `hierarchy.json` | API 层级树 |
| `links-tree.json` | 链接层级树 |
| `link-tree-full.json` | 广告链接按 section 分组 |
| `apps-full.json` | 全部应用（含 orgUrl 跳转链接） |
| `api/in-page/browser-api.json` | 浏览器内 API 原始数据 |
| `covers/` | 应用 cover 图标 |
| `gifs/` | GIF 动图 |
| `assets/` | 其他静态资源 |

## 技术栈

- Vue 3 + Vite + Vue Router
- Playwright 爬虫
- rem 移动端布局
