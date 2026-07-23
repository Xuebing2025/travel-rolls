# 旅卷 / TRAVEL ROLLS

私人旅行影像档案网站。当前仓库处于第一阶段：桌面端视觉与核心交互原型。

## 当前已实现

- 杂志式首页与五条旅行横幅展开动效
- 最近五次旅行、旅行详情与纯文字旅行占位
- 高德地图 JS API 2.0 安全加载、全国地级市着色与省市钻取模块
- 旅行归档、权限感知搜索界面
- 瀑布流/网格视觉基础
- 管理中心、存储预警与上传确认流程入口
- `prefers-reduced-motion` 无障碍适配
- 禁止搜索引擎收录

## 尚未接入

- 高德地图 Key、Cloudflare 地图安全代理及正式数据联调
- Cloudflare Workers / D1 / R2
- 邮箱验证码、角色与内容权限
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
2. 将公开的 JS Key 写入 `config.js` 的 `amapKey`。
3. 部署 Worker 后，将地址写入 `config.js` 的 `amapServiceHost`，例如 `https://api.example.workers.dev`。
4. 使用 `wrangler secret put AMAP_SECURITY_CODE` 设置安全密钥。禁止把 `securityJsCode` 写入 `config.js`、提交记录或聊天。

未配置 Key 或代理时，页面自动显示34个省级行政区的无边界降级导航，不会展示来源不明的地图轮廓。
