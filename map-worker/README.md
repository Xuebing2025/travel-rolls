# TRAVEL ROLLS 地图安全代理

独立 Cloudflare Worker，仅为高德地图 JS API 添加服务端保存的 `securityJsCode`。

```powershell
pnpm install
pnpm exec wrangler login
pnpm exec wrangler secret put AMAP_SECURITY_CODE
pnpm exec wrangler secret put AMAP_JS_KEY
pnpm exec wrangler deploy
```

安全规则：

- 仅接受 `APP_ORIGINS` 中的网页来源。
- 仅代理 `/_AMapService/v3|v4|v5/*` 与自定义地图样式路径。
- 上游主机固定为高德 `restapi.amap.com` 或 `webapi.amap.com`。
- 不提供读取密钥的接口，不在日志中输出目标查询参数。
- `/config` 仅向允许的网页来源返回浏览器必须使用的公开 JS Key；绝不返回 `securityJsCode`。
