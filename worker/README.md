# 旅卷 API

Cloudflare Workers + D1 + R2 的可迁移业务后端。

## 已实现的接口

- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET|POST|PATCH|DELETE /api/trips...`（旅行、版本、分享、城市、标签与排序）
- `GET|POST|PATCH|DELETE /api/admin...`（邀请、账号、概览与审计）
- `GET|POST|PATCH|DELETE /api/media...`（元数据、派生图、回收站、点赞、收藏与下载）
- `GET /api/map`、`GET /api/stats`、`GET /api/search`、`GET /api/favorites`
- `GET|POST /api/places`（中国地级市与 GeoNames 境外主要城市）
- `GET|PATCH /api/settings`、`GET /api/export`、`GET /api/trash`
- `GET|POST /_AMapService/*`（高德安全密钥代理，仅允许高德固定服务路径）
- `POST /api/uploads/initiate`
- `PUT /api/uploads/:uploadId/parts/:partNumber`
- `POST /api/uploads/:uploadId/complete`
- `DELETE /api/uploads/:uploadId`

## 部署前必须完成

1. 创建D1数据库与R2存储桶，并替换`wrangler.toml`中的数据库ID。
2. 使用 `wrangler d1 migrations apply travel-rolls --remote` 顺序应用全部迁移。
3. 设置`OTP_PEPPER`、`RESEND_API_KEY`与`BOOTSTRAP_ADMIN_EMAIL`。
4. 验证`xbgzh.site`发信域名。
5. 保留`BOOTSTRAP_ADMIN_EMAIL`作为存储预警收件人；更换管理员邮箱时同步更新 Secret。
6. 将`APP_ORIGINS`改为预览地址和正式地址。

公开仓库不得包含任何真实邮箱、API密钥、R2凭据、验证码或用户数据。

生产地图使用仓库中的独立 `map-worker/` 安全代理；业务 Worker 的地图代理路由仅作为兼容入口。
