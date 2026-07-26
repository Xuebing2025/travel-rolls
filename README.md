# 旅卷 / TRAVEL ROLLS

私人旅行影像档案网站。当前仓库处于第一阶段：桌面端视觉、合规地图与核心交互原型。

## 当前已实现

- 杂志式首页与五条旅行横幅展开动效
- 最近五次旅行、旅行详情与纯文字旅行占位
- 高德地图 JS API 2.0 安全加载、全国地级市着色与省市钻取模块
- `travel.xbgzh.site` 自定义域、完整 Cloudflare Worker、D1、私有 R2 与 Resend 发信基础设施
- 可安全预览、编辑并在浏览器保存最近 5 个 Markdown 游记版本
- 邀请制邮箱验证码登录/验证界面及 API 接线
- 全站彩色标签与横幅字色本地设置
- 旅行归档、权限感知搜索界面
- 旅行照片网格视觉基础
- 管理中心、存储预警与上传确认流程入口
- `prefers-reduced-motion` 无障碍适配
- 禁止搜索引擎收录

完整状态与逐项差距见 [`docs/requirements-audit.md`](./docs/requirements-audit.md)。

## 尚未接入

- 邀请管理 API、除引导管理员外的受邀用户流程、完整角色与内容权限
- 真实上传、EXIF解析、分片续传及媒体处理
- 智能视觉编排、回收站、版本历史与操作日志

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
