# 旅卷 API

Cloudflare Workers + D1 + R2 的可迁移后端骨架。

## 已实现的接口

- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/trips`
- `GET|POST /_AMapService/*`（高德安全密钥代理，仅允许高德固定服务路径）
- `POST /api/uploads/initiate`
- `PUT /api/uploads/:uploadId/parts/:partNumber`
- `POST /api/uploads/:uploadId/complete`
- `DELETE /api/uploads/:uploadId`

## 部署前必须完成

1. 创建D1数据库与R2存储桶，并替换`wrangler.toml`中的数据库ID。
2. 执行`migrations/0001_initial.sql`。
3. 设置`OTP_PEPPER`、`RESEND_API_KEY`与`AMAP_SECURITY_CODE`三个secret。
4. 验证`xbgzh.site`发信域名。
5. 将`BOOTSTRAP_ADMIN_EMAIL`临时设置为管理员邮箱，首次登录后再移除。
6. 将`APP_ORIGINS`改为预览地址和正式地址。

公开仓库不得包含任何真实邮箱、API密钥、R2凭据、验证码或用户数据。

高德地图前端必须把 `serviceHost` 指向本 Worker 的 `/_AMapService` 前缀。Worker 仅在转发至高德固定主机时附加 `AMAP_SECURITY_CODE`，不会向浏览器返回该密钥。
