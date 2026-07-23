const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const ALLOWED_MEDIA = new Map([
  ["image/jpeg", { kind: "image", max: 100 * 1024 * 1024, ext: "jpg" }],
  ["image/png", { kind: "image", max: 100 * 1024 * 1024, ext: "png" }],
  ["video/mp4", { kind: "video", max: 500 * 1024 * 1024, ext: "mp4" }],
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (!cors) return json({ error: "origin_not_allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      let response;
      if (url.pathname === "/api/health" && request.method === "GET") response = json({ ok: true, now: Date.now() });
      else if (url.pathname.startsWith("/_AMapService/")) response = await proxyAmap(request, env, url);
      else if (url.pathname === "/api/auth/request-code" && request.method === "POST") response = await requestCode(request, env);
      else if (url.pathname === "/api/auth/verify-code" && request.method === "POST") response = await verifyCode(request, env);
      else if (url.pathname === "/api/auth/logout" && request.method === "POST") response = await logout(request, env);
      else if (url.pathname === "/api/me" && request.method === "GET") response = await getMe(request, env);
      else if (url.pathname === "/api/trips" && request.method === "GET") response = await listTrips(request, env, url);
      else if (url.pathname === "/api/uploads/initiate" && request.method === "POST") response = await initiateUpload(request, env);
      else if (/^\/api\/uploads\/[^/]+\/parts\/\d+$/.test(url.pathname) && request.method === "PUT") response = await uploadPart(request, env, url);
      else if (/^\/api\/uploads\/[^/]+\/complete$/.test(url.pathname) && request.method === "POST") response = await completeUpload(request, env, url);
      else if (/^\/api\/uploads\/[^/]+$/.test(url.pathname) && request.method === "DELETE") response = await abortUpload(request, env, url);
      else response = json({ error: "not_found" }, 404);
      addHeaders(response.headers, cors);
      response.headers.set("x-content-type-options", "nosniff");
      response.headers.set("referrer-policy", "no-referrer");
      return response;
    } catch (error) {
      console.error("request_failed", error);
      const response = json({ error: "server_error" }, 500);
      addHeaders(response.headers, cors);
      return response;
    }
  },
};

async function proxyAmap(request, env, url) {
  if (!env.AMAP_SECURITY_CODE) return json({ error: "map_proxy_not_configured" }, 503);
  if (!["GET", "POST"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);

  const path = url.pathname.slice("/_AMapService".length);
  const isStyleRequest = path.startsWith("/v4/map/styles");
  const isWebServiceRequest = /^\/v(?:3|4|5)\//.test(path);
  if (!isStyleRequest && !isWebServiceRequest) return json({ error: "map_path_not_allowed" }, 404);

  const target = new URL(path, isStyleRequest ? "https://webapi.amap.com" : "https://restapi.amap.com");
  target.search = url.search;
  target.searchParams.set("jscode", env.AMAP_SECURITY_CODE);
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "POST" ? request.body : null,
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("set-cookie");
  if (request.method === "GET" && upstream.ok) responseHeaders.set("cache-control", "public, max-age=300");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function requestCode(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "invalid_email" }, 400);

  const now = Date.now();
  const existing = await env.DB.prepare("SELECT id, status FROM users WHERE email = ?").bind(email).first();
  const invitation = await env.DB.prepare(
    "SELECT id FROM invitations WHERE email = ? AND revoked_at IS NULL AND accepted_at IS NULL"
  ).bind(email).first();
  const isBootstrap = env.BOOTSTRAP_ADMIN_EMAIL && normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL) === email;
  if ((!existing && !invitation && !isBootstrap) || existing?.status === "frozen") {
    return json({ ok: true }); // Do not disclose membership.
  }

  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM login_codes WHERE email = ? AND created_at > ?"
  ).bind(email, now - 10 * 60 * 1000).first();
  if ((recent?.count || 0) >= 3) return json({ error: "rate_limited" }, 429);

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const id = crypto.randomUUID();
  const hash = await sha256(`${email}:${code}:${env.OTP_PEPPER}`);
  await env.DB.prepare(
    "INSERT INTO login_codes(id,email,code_hash,expires_at,created_at) VALUES(?,?,?,?,?)"
  ).bind(id, email, hash, now + 10 * 60 * 1000, now).run();

  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "user-agent": "travel-rolls/1.0",
      "idempotency-key": `login-code/${id}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "旅卷登录验证码",
      text: `你的旅卷登录验证码是：${code}\n\n10分钟内有效。请勿将验证码转发给他人。`,
    }),
  });
  if (!mail.ok) {
    console.error("email_failed", mail.status, await mail.text());
    return json({ error: "email_unavailable" }, 503);
  }
  return json({ ok: true });
}

async function verifyCode(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) return json({ error: "invalid_code" }, 400);

  const now = Date.now();
  const record = await env.DB.prepare(
    "SELECT * FROM login_codes WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).bind(email).first();
  if (!record || record.expires_at < now || record.failed_attempts >= 5) return json({ error: "invalid_code" }, 401);

  const hash = await sha256(`${email}:${code}:${env.OTP_PEPPER}`);
  if (hash !== record.code_hash) {
    await env.DB.prepare("UPDATE login_codes SET failed_attempts = failed_attempts + 1 WHERE id = ?").bind(record.id).run();
    return json({ error: "invalid_code", attemptsRemaining: Math.max(0, 4 - record.failed_attempts) }, 401);
  }

  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    const invite = await env.DB.prepare(
      "SELECT * FROM invitations WHERE email = ? AND revoked_at IS NULL AND accepted_at IS NULL"
    ).bind(email).first();
    const isBootstrap = env.BOOTSTRAP_ADMIN_EMAIL && normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL) === email;
    if (!invite && !isBootstrap) return json({ error: "invitation_required" }, 403);
    const userId = crypto.randomUUID();
    const role = isBootstrap ? "admin" : invite.role;
    const nickname = email.split("@")[0].slice(0, 40);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users(id,email,nickname,role,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)"
      ).bind(userId, email, nickname, role, "active", now, now),
      ...(invite
        ? [env.DB.prepare("UPDATE invitations SET accepted_at = ? WHERE id = ?").bind(now, invite.id)]
        : []),
    ]);
    user = { id: userId, email, nickname, role, status: "active" };
  }
  if (user.status !== "active") return json({ error: "account_frozen" }, 403);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare("UPDATE login_codes SET used_at = ? WHERE id = ?").bind(now, record.id),
    env.DB.prepare(
      "INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)"
    ).bind(sessionId, user.id, tokenHash, expiresAt, now),
  ]);

  const response = json({ user: publicUser(user) });
  response.headers.append(
    "set-cookie",
    `tr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
  );
  return response;
}

async function logout(request, env) {
  const token = cookie(request, "tr_session");
  if (token) await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?").bind(Date.now(), await sha256(token)).run();
  const response = json({ ok: true });
  response.headers.append("set-cookie", "tr_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return response;
}

async function getMe(request, env) {
  const user = await currentUser(request, env);
  return user ? json({ user: publicUser(user) }) : json({ user: null });
}

async function listTrips(request, env, url) {
  const user = await currentUser(request, env);
  const shareHash = url.searchParams.get("share") ? await sha256(url.searchParams.get("share")) : "";
  const rows = await env.DB.prepare(
    `SELECT t.id,t.slug,t.title,t.subtitle,t.start_date,t.end_date,t.visibility,t.author_id,
            u.nickname AS author_name,t.cover_media_id,t.updated_at
       FROM trips t JOIN users u ON u.id=t.author_id
      WHERE t.status='published'
        AND (
          t.visibility='public'
          OR (?1 IS NOT NULL AND (?2='admin' OR t.author_id=?1))
          OR (t.visibility='link' AND t.share_token_hash=?3)
        )
      ORDER BY t.start_date DESC, t.published_at DESC
      LIMIT 100`
  ).bind(user?.id || null, user?.role || null, shareHash).all();
  return json({ trips: rows.results });
}

async function initiateUpload(request, env) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const mediaType = ALLOWED_MEDIA.get(body.mimeType);
  if (!mediaType || !Number.isInteger(body.byteSize) || body.byteSize < 1 || body.byteSize > mediaType.max) {
    return json({ error: "unsupported_media" }, 400);
  }
  const trip = await env.DB.prepare("SELECT id,author_id,status FROM trips WHERE id=?").bind(body.tripId).first();
  if (!trip || (user.role !== "admin" && trip.author_id !== user.id)) return json({ error: "forbidden" }, 403);
  const place = await env.DB.prepare("SELECT id,country_code,city_code FROM places WHERE id=?").bind(body.placeId).first();
  if (!place) return json({ error: "invalid_place" }, 400);

  const cityCount = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM media m JOIN places p ON p.id=m.place_id
      WHERE p.country_code=? AND p.city_code=? AND m.status!='trash'`
  ).bind(place.country_code, place.city_code).first();
  if ((cityCount?.count || 0) >= 500) return json({ error: "city_limit_reached" }, 409);

  const usage = await env.DB.prepare("SELECT total_bytes FROM storage_usage WHERE singleton=1").first();
  const hardLimit = Number(env.STORAGE_HARD_LIMIT_BYTES || 9663676416);
  if ((usage?.total_bytes || 0) + body.byteSize > hardLimit) return json({ error: "storage_limit_reached" }, 507);

  const now = Date.now();
  const mediaId = crypto.randomUUID();
  const uploadId = crypto.randomUUID();
  const safeName = sanitizeFilename(body.filename || `upload.${mediaType.ext}`);
  const objectKey = `original/${body.tripId}/${mediaId}/${safeName}`;
  const multipart = await env.MEDIA.createMultipartUpload(objectKey, {
    httpMetadata: { contentType: body.mimeType, contentDisposition: `attachment; filename="${safeName}"` },
    customMetadata: { mediaId, uploaderId: user.id },
  });
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO media(id,trip_id,place_id,uploader_id,kind,original_key,original_filename,mime_type,byte_size,status,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,'uploading',?,?)`
    ).bind(mediaId, body.tripId, body.placeId, user.id, mediaType.kind, objectKey, safeName, body.mimeType, body.byteSize, now, now),
    env.DB.prepare(
      `INSERT INTO media_uploads(id,media_id,r2_upload_id,object_key,expected_size,part_size,status,expires_at,created_at)
       VALUES(?,?,?,?,?,?,'active',?,?)`
    ).bind(uploadId, mediaId, multipart.uploadId, objectKey, body.byteSize, 8 * 1024 * 1024, now + 24 * 60 * 60 * 1000, now),
  ]);
  return json({ uploadId, mediaId, partSize: 8 * 1024 * 1024, expiresAt: now + 24 * 60 * 60 * 1000 }, 201);
}

async function uploadPart(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const [, , , uploadId, , partText] = url.pathname.split("/");
  const partNumber = Number(partText);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) return json({ error: "invalid_part" }, 400);
  const upload = await ownedUpload(env, uploadId, user);
  if (!upload) return json({ error: "upload_not_found" }, 404);
  if (!request.body) return json({ error: "empty_part" }, 400);
  const multipart = env.MEDIA.resumeMultipartUpload(upload.object_key, upload.r2_upload_id);
  const part = await multipart.uploadPart(partNumber, request.body);
  return json({ partNumber: part.partNumber, etag: part.etag });
}

async function completeUpload(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const uploadId = url.pathname.split("/")[3];
  const upload = await ownedUpload(env, uploadId, user);
  if (!upload) return json({ error: "upload_not_found" }, 404);
  const body = await readJson(request);
  if (!Array.isArray(body.parts) || body.parts.length < 1) return json({ error: "parts_required" }, 400);
  const parts = body.parts.map((part) => ({ partNumber: Number(part.partNumber), etag: String(part.etag) }));
  const multipart = env.MEDIA.resumeMultipartUpload(upload.object_key, upload.r2_upload_id);
  const object = await multipart.complete(parts);
  if (object.size !== upload.expected_size) {
    await env.MEDIA.delete(upload.object_key);
    return json({ error: "size_mismatch" }, 400);
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE media_uploads SET status='completed' WHERE id=?").bind(uploadId),
    env.DB.prepare("UPDATE media SET status='processing',updated_at=? WHERE id=?").bind(now, upload.media_id),
    env.DB.prepare("UPDATE storage_usage SET total_bytes=total_bytes+?,updated_at=? WHERE singleton=1")
      .bind(object.size, now),
  ]);
  return json({ ok: true, mediaId: upload.media_id, status: "processing" });
}

async function abortUpload(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const uploadId = url.pathname.split("/")[3];
  const upload = await ownedUpload(env, uploadId, user);
  if (!upload) return json({ error: "upload_not_found" }, 404);
  await env.MEDIA.resumeMultipartUpload(upload.object_key, upload.r2_upload_id).abort();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE media_uploads SET status='aborted' WHERE id=?").bind(uploadId),
    env.DB.prepare("UPDATE media SET status='trash',deleted_at=?,purge_after=?,updated_at=? WHERE id=?")
      .bind(now, now + 30 * 24 * 60 * 60 * 1000, now, upload.media_id),
  ]);
  return json({ ok: true });
}

async function ownedUpload(env, uploadId, user) {
  return env.DB.prepare(
    `SELECT mu.*,m.uploader_id FROM media_uploads mu JOIN media m ON m.id=mu.media_id
      WHERE mu.id=? AND mu.status='active' AND mu.expires_at>? AND (m.uploader_id=? OR ?='admin')`
  ).bind(uploadId, Date.now(), user.id, user.role).first();
}

async function currentUser(request, env) {
  const token = cookie(request, "tr_session");
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`
  ).bind(await sha256(token), Date.now()).first();
}

async function requireRole(request, env, roles) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!roles.includes(user.role)) return json({ error: "forbidden" }, 403);
  return user;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = String(env.APP_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    vary: "Origin",
  };
}

function addHeaders(headers, values) {
  Object.entries(values).forEach(([key, value]) => headers.set(key, value));
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("json_required");
  return request.json();
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : "";
}

function sanitizeFilename(value) {
  const cleaned = value.normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, "-").slice(-120);
  return cleaned || "upload";
}

function publicUser(user) {
  return { id: user.id, email: user.email, nickname: user.nickname, avatarKey: user.avatar_key, role: user.role };
}

function cookie(request, name) {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
