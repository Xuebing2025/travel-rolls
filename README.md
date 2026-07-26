# 旅卷 / TRAVEL ROLLS

私人旅行影像档案网站。前端使用 GitHub Pages，业务 API 使用 Cloudflare Workers、D1、私有 R2 与 Resend。

## 当前已实现

- 杂志式首页与五条旅行横幅展开动效
- D1 驱动的最近五次旅行、旅行详情、纯文字旅行、归档与权限感知地图
- 高德地图 JS API 2.0 安全加载、全国地级市着色与省市钻取模块
- `travel.xbgzh.site` 自定义域、完整 Cloudflare Worker、D1、私有 R2 与 Resend 发信基础设施
- 可安全预览、编辑、恢复服务器端最近 5 个 Markdown 游记版本
- 邀请制邮箱验证码、访客/编辑者/管理员权限、冻结与邀请撤销
- 旅行 CRUD、公开/持链接/私密分享、全站标签、封面焦点与字色
- 批量 8MB 分片上传、重试/续传、EXIF 时间、区县级 GPS、图片派生图与隐私副本
- 网格/瀑布流、时间/手动/视觉相似排序、点赞、私人收藏与受保护下载
- 全文搜索、30 天回收站、JSON/CSV 导出、366 天审计日志与存储预警
- `prefers-reduced-motion` 无障碍适配
- 禁止搜索引擎收录

完整状态与逐项差距见 [`docs/requirements-audit.md`](./docs/requirements-audit.md)。

当前明确的增强项是视频自动海报/隐私安全转码，以及 DJI/荣耀动态照片的自动配对。详见需求核对表。

## 本地预览

这是无构建依赖的静态项目，可以使用任意静态文件服务器。例如：

```powershell
python -m http.server 4174
```

然后访问 `http://127.0.0.1:4174`。

## 隐私

测试图片为AI生成的无人物隐私占位素材。真实照片、密钥、用户数据和数据库文件不得提交到公开仓库。

## 地图配置

1. 在高德开放平台创建“Web端（JS API）”应用，添加预览域名与正式域名白名单。
2. 部署 Worker 后，将地址写入 `config.js` 的 `amapServiceHost`，例如 `https://api.example.workers.dev`。当前生产预览已配置独立地图代理。
3. 使用 `wrangler secret put AMAP_SECURITY_CODE` 设置安全密钥。
4. 使用 `wrangler secret put AMAP_JS_KEY` 保存浏览器 JS Key；Worker 只对允许来源的 `/config` 请求返回它。

禁止把 `securityJsCode` 写入 `config.js`、提交记录或聊天。

未配置 Key 或代理时，页面自动显示34个省级行政区的无边界降级导航，不会展示来源不明的地图轮廓。

`map-worker/` 是可以先于完整后端部署的独立地图安全代理，不依赖 D1 或 R2。

## 认证配置

生产前端通过 `config.js` 的 `apiBase` 连接 `https://api.xbgzh.site`。网站使用 `https://travel.xbgzh.site`，两者位于同一站点下，以便安全 Cookie 稳定工作。密钥仅保存在 Cloudflare Secrets，不得写入仓库。
