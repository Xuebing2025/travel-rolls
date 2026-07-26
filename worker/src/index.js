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
      else if (url.pathname === "/api/places" && request.method === "GET") response = await listPlaces(request, env, url);
      else if (url.pathname === "/api/map" && request.method === "GET") response = await mapSummary(request, env);
      else if (url.pathname === "/api/settings" && request.method === "GET") response = await getSettings(env);
      else if (url.pathname === "/api/settings" && request.method === "PATCH") response = await updateSettings(request, env);
      else if (url.pathname === "/api/tags" && request.method === "GET") response = await listTags(request, env);
      else if (url.pathname === "/api/tags" && request.method === "POST") response = await createTag(request, env);
      else if (/^\/api\/tags\/[^/]+$/.test(url.pathname) && request.method === "PATCH") response = await updateTag(request, env, url);
      else if (/^\/api\/tags\/[^/]+$/.test(url.pathname) && request.method === "DELETE") response = await deleteTag(request, env, url);
      else if (url.pathname === "/api/admin/overview" && request.method === "GET") response = await adminOverview(request, env);
      else if (url.pathname === "/api/admin/invitations" && request.method === "GET") response = await listInvitations(request, env);
      else if (url.pathname === "/api/admin/invitations" && request.method === "POST") response = await createInvitation(request, env);
      else if (/^\/api\/admin\/invitations\/[^/]+$/.test(url.pathname) && request.method === "DELETE") response = await revokeInvitation(request, env, url);
      else if (url.pathname === "/api/admin/users" && request.method === "GET") response = await listUsers(request, env);
      else if (url.pathname === "/api/admin/audit" && request.method === "GET") response = await listAudit(request, env, url);
      else if (/^\/api\/admin\/users\/[^/]+$/.test(url.pathname) && request.method === "PATCH") response = await updateUser(request, env, url);
      else if (url.pathname === "/api/trips" && request.method === "GET") response = await listTrips(request, env, url);
      else if (url.pathname === "/api/trips" && request.method === "POST") response = await createTrip(request, env);
      else if (/^\/api\/trips\/[^/]+\/versions$/.test(url.pathname) && request.method === "GET") response = await listTripVersions(request, env, url);
      else if (/^\/api\/trips\/[^/]+\/versions\/[^/]+\/restore$/.test(url.pathname) && request.method === "POST") response = await restoreTripVersion(request, env, url);
      else if (/^\/api\/trips\/[^/]+\/share-token$/.test(url.pathname) && request.method === "POST") response = await rotateShareToken(request, env, url);
      else if (/^\/api\/trips\/[^/]+\/media$/.test(url.pathname) && request.method === "GET") response = await listTripMedia(request, env, url);
      else if (/^\/api\/trips\/[^/]+\/media-order$/.test(url.pathname) && request.method === "POST") response = await updateMediaOrder(request, env, url);
      else if (/^\/api\/trips\/[^/]+\/smart-sort$/.test(url.pathname) && request.method === "POST") response = await calculateSmartSort(request, env, url);
      else if (/^\/api\/trips\/[^/]+$/.test(url.pathname) && request.method === "GET") response = await getTrip(request, env, url);
      else if (/^\/api\/trips\/[^/]+$/.test(url.pathname) && request.method === "PATCH") response = await updateTrip(request, env, url);
      else if (/^\/api\/trips\/[^/]+$/.test(url.pathname) && request.method === "DELETE") response = await deleteTrip(request, env, url);
      else if (url.pathname === "/api/uploads/initiate" && request.method === "POST") response = await initiateUpload(request, env);
      else if (/^\/api\/uploads\/[^/]+\/parts\/\d+$/.test(url.pathname) && request.method === "PUT") response = await uploadPart(request, env, url);
      else if (/^\/api\/uploads\/[^/]+\/complete$/.test(url.pathname) && request.method === "POST") response = await completeUpload(request, env, url);
      else if (/^\/api\/uploads\/[^/]+$/.test(url.pathname) && request.method === "DELETE") response = await abortUpload(request, env, url);
      else if (/^\/api\/media\/[^/]+$/.test(url.pathname) && request.method === "PATCH") response = await updateMedia(request, env, url);
      else if (/^\/api\/media\/[^/]+$/.test(url.pathname) && request.method === "DELETE") response = await trashMedia(request, env, url);
      else if (/^\/api\/media\/[^/]+\/restore$/.test(url.pathname) && request.method === "POST") response = await restoreMedia(request, env, url);
      else if (/^\/api\/media\/[^/]+\/like$/.test(url.pathname) && request.method === "POST") response = await toggleMediaReaction(request, env, url, "likes");
      else if (/^\/api\/media\/[^/]+\/likes$/.test(url.pathname) && request.method === "GET") response = await listMediaLikes(request, env, url);
      else if (/^\/api\/media\/[^/]+\/favorite$/.test(url.pathname) && request.method === "POST") response = await toggleMediaReaction(request, env, url, "favorites");
      else if (/^\/api\/media\/[^/]+\/content$/.test(url.pathname) && request.method === "GET") response = await serveMediaContent(request, env, url);
      else if (/^\/api\/media\/[^/]+\/variants\/(?:web|thumb|poster|safe)$/.test(url.pathname) && request.method === "PUT") response = await uploadMediaVariant(request, env, url);
      else if (url.pathname === "/api/search" && request.method === "GET") response = await searchContent(request, env, url);
      else if (url.pathname === "/api/favorites" && request.method === "GET") response = await listFavorites(request, env);
      else if (url.pathname === "/api/export" && request.method === "GET") response = await exportData(request, env, url);
      else if (url.pathname === "/api/trash" && request.method === "GET") response = await listTrash(request, env);
      else if (/^\/api\/trips\/[^/]+\/restore$/.test(url.pathname) && request.method === "POST") response = await restoreTrip(request, env, url);
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
  async scheduled(_controller, env, context) {
    context.waitUntil(runMaintenance(env));
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
  for (const name of ["accept", "accept-language", "content-type", "origin", "referer", "user-agent"]) {
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

async function listPlaces(request, env, url) {
  const query = cleanText(url.searchParams.get("q"), 80);
  const rows = query
    ? await env.DB.prepare(
        `SELECT id,country_code,province_code,city_code,official_name,display_name,level,center_lat,center_lng
           FROM places WHERE official_name LIKE ?1 OR display_name LIKE ?1 OR city_code LIKE ?1
          ORDER BY province_code,city_code LIMIT 100`
      ).bind(`%${query}%`).all()
    : await env.DB.prepare(
        `SELECT id,country_code,province_code,city_code,official_name,display_name,level,center_lat,center_lng
           FROM places ORDER BY province_code,city_code LIMIT 500`
      ).all();
  return json({ places: rows.results });
}

async function mapSummary(request, env) {
  const user = await currentUser(request, env);
  const rows = await env.DB.prepare(
    `SELECT p.city_code,p.province_code,p.display_name,p.official_name,p.center_lat,p.center_lng,
            COUNT(DISTINCT t.id) AS visit_count,
            COUNT(DISTINCT CASE WHEN m.status='ready' THEN m.id END) AS media_count,
            MIN(t.id) AS trip_id,
            MIN(t.title) AS trip_title
       FROM trips t
       JOIN trip_places tp ON tp.trip_id=t.id
       JOIN places p ON p.id=tp.place_id
       LEFT JOIN media m ON m.trip_id=t.id AND m.place_id=p.id
      WHERE t.status='published'
        AND (t.visibility='public' OR (?1 IS NOT NULL AND (?2='admin' OR t.author_id=?1)))
      GROUP BY p.id
      ORDER BY p.province_code,p.city_code`
  ).bind(user?.id || null, user?.role || null).all();
  return json({ cities: rows.results });
}

async function getSettings(env) {
  const rows = await env.DB.prepare("SELECT key,value,updated_at FROM site_settings").all();
  return json({ settings: Object.fromEntries(rows.results.map((row) => [row.key, row.value])) });
}

async function updateSettings(request, env) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const subtitle = cleanText(body.subtitle, 80);
  if (!subtitle) return json({ error: "invalid_subtitle" }, 400);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO site_settings(key,value,updated_by,updated_at) VALUES('subtitle',?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at`
  ).bind(subtitle, user.id, now).run();
  await writeAudit(env, user.id, "settings.update", "site", null, { subtitle });
  return json({ settings: { subtitle } });
}

async function listTags(request, env) {
  const user = await currentUser(request, env);
  if (user && ["editor", "admin"].includes(user.role)) await ensureStoryTag(env, user.id);
  const rows = user
    ? await env.DB.prepare(
        `SELECT t.id,t.name,t.color,t.is_system,t.created_at,t.updated_at,
                COUNT(DISTINCT tt.trip_id) AS trip_count,COUNT(DISTINCT mt.media_id) AS media_count
           FROM tags t
           LEFT JOIN trip_tags tt ON tt.tag_id=t.id
           LEFT JOIN media_tags mt ON mt.tag_id=t.id
          GROUP BY t.id ORDER BY t.is_system DESC,t.name COLLATE NOCASE`
      ).all()
    : await env.DB.prepare(
        `SELECT DISTINCT t.id,t.name,t.color,t.is_system,t.created_at,t.updated_at
           FROM tags t JOIN trip_tags tt ON tt.tag_id=t.id JOIN trips tr ON tr.id=tt.trip_id
          WHERE tr.status='published' AND tr.visibility='public'
          ORDER BY t.is_system DESC,t.name COLLATE NOCASE`
      ).all();
  return json({ tags: rows.results });
}

async function createTag(request, env) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const name = cleanText(body.name, 24);
  const color = normalizeColor(body.color);
  if (!name || !color) return json({ error: "invalid_tag" }, 400);
  const now = Date.now();
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO tags(id,name,color,is_system,created_by,created_at,updated_at) VALUES(?,?,?,0,?,?,?)"
    ).bind(id, name, color, user.id, now, now).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "tag_exists" }, 409);
    throw error;
  }
  await writeAudit(env, user.id, "tag.create", "tag", id, { name, color });
  return json({ tag: { id, name, color, is_system: 0, trip_count: 0, media_count: 0 } }, 201);
}

async function updateTag(request, env, url) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const existing = await env.DB.prepare("SELECT * FROM tags WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "tag_not_found" }, 404);
  const body = await readJson(request);
  const name = existing.is_system ? existing.name : cleanText(body.name ?? existing.name, 24);
  const color = normalizeColor(body.color ?? existing.color);
  if (!name || !color) return json({ error: "invalid_tag" }, 400);
  try {
    await env.DB.prepare("UPDATE tags SET name=?,color=?,updated_at=? WHERE id=?")
      .bind(name, color, Date.now(), id).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "tag_exists" }, 409);
    throw error;
  }
  await writeAudit(env, user.id, "tag.update", "tag", id, { name, color });
  return json({ tag: { ...existing, name, color } });
}

async function deleteTag(request, env, url) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const tag = await env.DB.prepare("SELECT * FROM tags WHERE id=?").bind(id).first();
  if (!tag) return json({ error: "tag_not_found" }, 404);
  if (tag.is_system) return json({ error: "system_tag_immutable" }, 409);
  const usage = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM trip_tags WHERE tag_id=?1) +
      (SELECT COUNT(*) FROM media_tags WHERE tag_id=?1) AS count`
  ).bind(id).first();
  if (Number(usage?.count || 0) > 0) return json({ error: "tag_in_use" }, 409);
  await env.DB.prepare("DELETE FROM tags WHERE id=?").bind(id).run();
  await writeAudit(env, user.id, "tag.delete", "tag", id, { name: tag.name });
  return json({ ok: true });
}

async function adminOverview(request, env) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const [users, invitations, trips, media, storage, pending] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM invitations WHERE revoked_at IS NULL AND accepted_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM trips WHERE status!='trash'").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM media WHERE status!='trash'").first(),
    env.DB.prepare("SELECT total_bytes,reserved_bytes,updated_at FROM storage_usage WHERE singleton=1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM media WHERE status IN ('processing','failed') OR date_status='pending'").first(),
  ]);
  return json({
    overview: {
      users: users.count,
      pendingInvitations: invitations.count,
      trips: trips.count,
      media: media.count,
      pendingMedia: pending.count,
      storageBytes: storage.total_bytes,
      storageReservedBytes: storage.reserved_bytes,
      storageUpdatedAt: storage.updated_at,
      storageSoftLimitBytes: Number(env.STORAGE_SOFT_LIMIT_BYTES || 8589934592),
      storageHardLimitBytes: Number(env.STORAGE_HARD_LIMIT_BYTES || 9663676416),
    },
  });
}

async function listInvitations(request, env) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const rows = await env.DB.prepare(
    `SELECT i.id,i.email,i.role,i.revoked_at,i.accepted_at,i.created_at,
            u.nickname AS invited_by_name
       FROM invitations i JOIN users u ON u.id=i.invited_by
      ORDER BY i.created_at DESC LIMIT 200`
  ).all();
  return json({ invitations: rows.results });
}

async function createInvitation(request, env) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const role = ["visitor", "editor"].includes(body.role) ? body.role : "";
  if (!email || !role) return json({ error: "invalid_invitation" }, 400);
  const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
  if (existingUser) return json({ error: "user_already_exists" }, 409);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO invitations(id,email,role,invited_by,revoked_at,accepted_at,created_at)
     VALUES(?,?,?,?,NULL,NULL,?)
     ON CONFLICT(email) DO UPDATE SET
       id=excluded.id,role=excluded.role,invited_by=excluded.invited_by,
       revoked_at=NULL,accepted_at=NULL,created_at=excluded.created_at`
  ).bind(id, email, role, user.id, now).run();
  await writeAudit(env, user.id, "invitation.create", "invitation", id, { email, role });
  const emailSent = await sendEmail(env, {
    to: email,
    subject: "你已受邀加入 TRAVEL ROLLS",
    text: `你已受邀以“${role === "editor" ? "编辑者" : "访客"}”身份加入 TRAVEL ROLLS。\n\n请打开 https://travel.xbgzh.site/#login 并使用此邮箱获取登录验证码。`,
    idempotencyKey: `invitation/${id}`,
  });
  return json({ invitation: { id, email, role, revoked_at: null, accepted_at: null, created_at: now }, emailSent }, 201);
}

async function revokeInvitation(request, env, url) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 4);
  const existing = await env.DB.prepare("SELECT id,email,accepted_at FROM invitations WHERE id=?").bind(id).first();
  if (!existing) return json({ error: "invitation_not_found" }, 404);
  if (existing.accepted_at) return json({ error: "invitation_already_accepted" }, 409);
  const now = Date.now();
  await env.DB.prepare("UPDATE invitations SET revoked_at=? WHERE id=?").bind(now, id).run();
  await writeAudit(env, user.id, "invitation.revoke", "invitation", id, { email: existing.email });
  return json({ ok: true, revokedAt: now });
}

async function listUsers(request, env) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const rows = await env.DB.prepare(
    `SELECT id,email,nickname,role,status,created_at,updated_at,
            (SELECT COUNT(*) FROM trips t WHERE t.author_id=users.id AND t.status!='trash') AS trip_count
       FROM users ORDER BY created_at ASC`
  ).all();
  return json({ users: rows.results });
}

async function listAudit(request, env, url) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 80)));
  const rows = await env.DB.prepare(
    `SELECT a.id,a.action,a.target_type,a.target_id,a.detail_json,a.created_at,
            u.email AS actor_email,u.nickname AS actor_name
       FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id
      ORDER BY a.created_at DESC LIMIT ?`
  ).bind(limit).all();
  return json({ logs: rows.results });
}

async function updateUser(request, env, url) {
  const actor = await requireRole(request, env, ["admin"]);
  if (actor instanceof Response) return actor;
  const id = pathSegment(url, 4);
  const target = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
  if (!target) return json({ error: "user_not_found" }, 404);
  const body = await readJson(request);
  const role = body.role === undefined ? target.role : (["visitor", "editor", "admin"].includes(body.role) ? body.role : "");
  const status = body.status === undefined ? target.status : (["active", "frozen"].includes(body.status) ? body.status : "");
  const nickname = body.nickname === undefined ? target.nickname : cleanText(body.nickname, 40);
  if (!role || !status || !nickname) return json({ error: "invalid_user_update" }, 400);
  if (actor.id === id && (role !== "admin" || status !== "active")) {
    return json({ error: "cannot_disable_self" }, 409);
  }
  if (target.role === "admin" && (role !== "admin" || status !== "active")) {
    const activeAdmins = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND status='active'"
    ).first();
    if (activeAdmins.count <= 1) return json({ error: "last_admin_required" }, 409);
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET nickname=?,role=?,status=?,updated_at=? WHERE id=?")
      .bind(nickname, role, status, now, id),
    ...(status === "frozen"
      ? [env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(now, id)]
      : []),
  ]);
  await writeAudit(env, actor.id, "user.update", "user", id, { role, status });
  return json({ user: { id, email: target.email, nickname, role, status } });
}

async function listTrips(request, env, url) {
  const user = await currentUser(request, env);
  const scope = url.searchParams.get("scope");
  if (scope === "manage") {
    if (!user || !["editor", "admin"].includes(user.role)) return json({ error: "authentication_required" }, 401);
    const rows = await env.DB.prepare(
      `SELECT t.id,t.slug,t.title,t.subtitle,t.start_date,t.end_date,t.visibility,t.status,t.author_id,
              u.nickname AS author_name,t.cover_media_id,t.updated_at,
              (SELECT COUNT(*) FROM media m WHERE m.trip_id=t.id AND m.status!='trash') AS media_count
         FROM trips t JOIN users u ON u.id=t.author_id
        WHERE t.status!='trash' AND (?1='admin' OR t.author_id=?2)
        ORDER BY t.start_date DESC,t.created_at DESC LIMIT 200`
    ).bind(user.role, user.id).all();
    return json({ trips: rows.results });
  }
  const shareHash = url.searchParams.get("share") ? await sha256(url.searchParams.get("share")) : "";
  const rows = await env.DB.prepare(
    `SELECT t.id,t.slug,t.title,t.subtitle,t.start_date,t.end_date,t.visibility,t.author_id,
            u.nickname AS author_name,t.cover_media_id,t.cover_text_side,t.cover_text_tone,
            t.cover_focus_x,t.cover_focus_y,t.updated_at,
            (SELECT COUNT(*) FROM media m WHERE m.trip_id=t.id AND m.status='ready') AS media_count
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

async function getTrip(request, env, url) {
  const id = pathSegment(url, 3);
  const user = await currentUser(request, env);
  const shareHash = url.searchParams.get("share") ? await sha256(url.searchParams.get("share")) : "";
  const trip = await env.DB.prepare(
    `SELECT t.*,u.nickname AS author_name
       FROM trips t JOIN users u ON u.id=t.author_id
      WHERE (t.id=?1 OR t.slug=?1) AND t.status!='trash'`
  ).bind(id).first();
  if (!trip || !(await canViewTrip(trip, user, shareHash))) return json({ error: "trip_not_found" }, 404);
  return json({ trip: await enrichTrip(env, trip, user) });
}

async function createTrip(request, env) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const body = await readJson(request);
  const input = normalizeTripInput(body);
  if (input.error) return json({ error: input.error }, 400);
  const relationError = await validateTripRelations(env, input.placeIds, input.tagIds);
  if (relationError) return json({ error: relationError }, 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  const slug = await uniqueSlug(env, body.slug || input.title, id);
  const shareToken = input.visibility === "link" ? randomToken() : "";
  const shareHash = shareToken ? await sha256(shareToken) : null;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO trips(
        id,slug,author_id,title,subtitle,start_date,end_date,markdown,visibility,share_token_hash,status,date_source,
        published_at,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, slug, user.id, input.title, input.subtitle, input.startDate, input.endDate, input.markdown,
      input.visibility, shareHash, input.status, input.dateSource, input.status === "published" ? now : null, now, now
    ),
    ...tripRelationStatements(env, id, input.placeIds, input.tagIds),
  ]);
  await writeAudit(env, user.id, "trip.create", "trip", id, { title: input.title, status: input.status });
  const trip = await env.DB.prepare("SELECT t.*,u.nickname AS author_name FROM trips t JOIN users u ON u.id=t.author_id WHERE t.id=?")
    .bind(id).first();
  return json({ trip: await enrichTrip(env, trip, user), shareToken: shareToken || undefined }, 201);
}

async function updateTrip(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const existing = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(id).first();
  if (!existing) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(existing, user)) return json({ error: "forbidden" }, 403);
  const body = await readJson(request);
  const input = normalizeTripInput({
    title: body.title ?? existing.title,
    subtitle: body.subtitle ?? existing.subtitle,
    startDate: body.startDate ?? existing.start_date,
    endDate: body.endDate ?? existing.end_date,
    markdown: body.markdown ?? existing.markdown,
    visibility: body.visibility ?? existing.visibility,
    status: body.status ?? existing.status,
    dateSource: body.dateSource ?? existing.date_source ?? "auto",
    placeIds: body.placeIds ?? undefined,
    tagIds: body.tagIds ?? undefined,
  });
  if (input.error) return json({ error: input.error }, 400);
  const relationError = await validateTripRelations(
    env,
    Array.isArray(body.placeIds) ? input.placeIds : [],
    Array.isArray(body.tagIds) ? input.tagIds : []
  );
  if (relationError) return json({ error: relationError }, 400);
  const now = Date.now();
  const contentChanged = input.title !== existing.title || input.markdown !== existing.markdown;
  const referencedMediaIds = contentChanged ? extractReferencedMediaIds(input.markdown) : [];
  let storyTagId = "";
  if (contentChanged) {
    if (referencedMediaIds.length) {
      const placeholders = referencedMediaIds.map(() => "?").join(",");
      const valid = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM media m JOIN trips t ON t.id=m.trip_id
          WHERE m.id IN (${placeholders}) AND m.status!='trash' AND (?='admin' OR t.author_id=?)`
      ).bind(...referencedMediaIds, user.role, user.id).first();
      if (Number(valid.count) !== referencedMediaIds.length) return json({ error: "invalid_story_media_reference" }, 409);
    }
    storyTagId = await ensureStoryTag(env, user.id);
  }
  const coverMediaId = body.coverMediaId === undefined ? existing.cover_media_id : (body.coverMediaId || null);
  if (coverMediaId) {
    const cover = await env.DB.prepare(
      "SELECT 1 FROM media WHERE id=? AND trip_id=? AND kind='image' AND status='ready'"
    ).bind(coverMediaId, id).first();
    if (!cover) return json({ error: "invalid_cover_media" }, 409);
  }
  const coverTextSide = body.coverTextSide === undefined
    ? existing.cover_text_side
    : (["left", "right"].includes(body.coverTextSide) ? body.coverTextSide : "");
  const coverTextTone = body.coverTextTone === undefined
    ? existing.cover_text_tone
    : (body.coverTextTone === null || body.coverTextTone === "" ? null : (["light", "dark"].includes(body.coverTextTone) ? body.coverTextTone : ""));
  if (!coverTextSide || coverTextTone === "") return json({ error: "invalid_cover_style" }, 400);
  const coverFocusX = body.coverFocusX === undefined ? Number(existing.cover_focus_x) : Number(body.coverFocusX);
  const coverFocusY = body.coverFocusY === undefined ? Number(existing.cover_focus_y) : Number(body.coverFocusY);
  if (!Number.isFinite(coverFocusX) || !Number.isFinite(coverFocusY)
    || coverFocusX < 0 || coverFocusX > 1 || coverFocusY < 0 || coverFocusY > 1) {
    return json({ error: "invalid_cover_focus" }, 400);
  }
  let shareToken = "";
  let shareHash = existing.share_token_hash;
  if (input.visibility === "link" && !shareHash) {
    shareToken = randomToken();
    shareHash = await sha256(shareToken);
  } else if (input.visibility !== "link") {
    shareHash = null;
  }
  const statements = [
    ...(contentChanged
      ? [
        env.DB.prepare(
          "INSERT INTO trip_versions(id,trip_id,markdown,title,created_by,created_at) VALUES(?,?,?,?,?,?)"
        ).bind(crypto.randomUUID(), id, existing.markdown, existing.title, user.id, now),
        env.DB.prepare("DELETE FROM trip_media_references WHERE trip_id=?").bind(id),
        ...referencedMediaIds.map((mediaId) =>
          env.DB.prepare("INSERT INTO trip_media_references(trip_id,media_id,created_at) VALUES(?,?,?)").bind(id, mediaId, now)
        ),
        ...referencedMediaIds.map((mediaId) =>
          env.DB.prepare("INSERT OR IGNORE INTO media_tags(media_id,tag_id) VALUES(?,?)").bind(mediaId, storyTagId)
        ),
      ]
      : []),
    env.DB.prepare(
      `UPDATE trips SET title=?,subtitle=?,start_date=?,end_date=?,markdown=?,visibility=?,share_token_hash=?,date_source=?,
              cover_media_id=?,cover_text_side=?,cover_text_tone=?,cover_focus_x=?,cover_focus_y=?,
              status=?,published_at=CASE WHEN ?='published' AND published_at IS NULL THEN ? ELSE published_at END,
              updated_at=? WHERE id=?`
    ).bind(
      input.title, input.subtitle, input.startDate, input.endDate, input.markdown, input.visibility, shareHash,
      input.dateSource, coverMediaId, coverTextSide, coverTextTone, coverFocusX, coverFocusY,
      input.status, input.status, now, now, id
    ),
  ];
  if (Array.isArray(body.placeIds)) {
    statements.push(env.DB.prepare("DELETE FROM trip_places WHERE trip_id=?").bind(id));
    statements.push(...tripRelationStatements(env, id, input.placeIds, [], false));
  }
  if (Array.isArray(body.tagIds)) {
    statements.push(env.DB.prepare("DELETE FROM trip_tags WHERE trip_id=?").bind(id));
    statements.push(...tripRelationStatements(env, id, [], input.tagIds, false));
  }
  await env.DB.batch(statements);
  if (contentChanged) {
    await env.DB.prepare(
      `DELETE FROM trip_versions WHERE id IN (
        SELECT id FROM trip_versions WHERE trip_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 5
      )`
    ).bind(id).run();
    await env.DB.prepare(
      `DELETE FROM media_tags WHERE tag_id=? AND media_id NOT IN (
        SELECT DISTINCT media_id FROM trip_media_references
      )`
    ).bind(storyTagId).run();
  }
  await writeAudit(env, user.id, "trip.update", "trip", id, { status: input.status, visibility: input.visibility });
  const trip = await env.DB.prepare("SELECT t.*,u.nickname AS author_name FROM trips t JOIN users u ON u.id=t.author_id WHERE t.id=?")
    .bind(id).first();
  return json({ trip: await enrichTrip(env, trip, user), shareToken: shareToken || undefined });
}

async function deleteTrip(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(id).first();
  if (!trip) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  const now = Date.now();
  const purgeAfter = now + 30 * 24 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE trips SET deleted_from_status=status,status='trash',deleted_at=?,purge_after=?,updated_at=? WHERE id=?"
    ).bind(now, purgeAfter, now, id),
    env.DB.prepare(
      `UPDATE media SET deleted_from_status=status,status='trash',deleted_at=?,purge_after=?,updated_at=?
        WHERE trip_id=? AND status!='trash'
          AND NOT EXISTS (
            SELECT 1 FROM trip_media_references r WHERE r.media_id=media.id AND r.trip_id!=?
          )`
    ).bind(now, purgeAfter, now, id, id),
  ]);
  await writeAudit(env, user.id, "trip.trash", "trip", id, { purgeAfter });
  return json({ ok: true, purgeAfter });
}

async function listTripVersions(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(id).first();
  if (!trip) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  const rows = await env.DB.prepare(
    `SELECT v.id,v.title,v.markdown,v.created_at,u.nickname AS created_by_name
       FROM trip_versions v JOIN users u ON u.id=v.created_by
      WHERE v.trip_id=? ORDER BY v.created_at DESC LIMIT 5`
  ).bind(id).all();
  return json({ versions: rows.results });
}

async function restoreTripVersion(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const parts = url.pathname.split("/");
  const tripId = decodeURIComponent(parts[3]);
  const versionId = decodeURIComponent(parts[5]);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(tripId).first();
  if (!trip) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  const version = await env.DB.prepare("SELECT * FROM trip_versions WHERE id=? AND trip_id=?")
    .bind(versionId, tripId).first();
  if (!version) return json({ error: "version_not_found" }, 404);
  const now = Date.now();
  const referencedMediaIds = extractReferencedMediaIds(version.markdown);
  if (referencedMediaIds.length) {
    const placeholders = referencedMediaIds.map(() => "?").join(",");
    const valid = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM media m JOIN trips t ON t.id=m.trip_id
        WHERE m.id IN (${placeholders}) AND m.status!='trash' AND (?='admin' OR t.author_id=?)`
    ).bind(...referencedMediaIds, user.role, user.id).first();
    if (Number(valid.count) !== referencedMediaIds.length) return json({ error: "invalid_story_media_reference" }, 409);
  }
  const storyTagId = await ensureStoryTag(env, user.id);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO trip_versions(id,trip_id,markdown,title,created_by,created_at) VALUES(?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), tripId, trip.markdown, trip.title, user.id, now),
    env.DB.prepare("UPDATE trips SET title=?,markdown=?,updated_at=? WHERE id=?")
      .bind(version.title, version.markdown, now, tripId),
    env.DB.prepare("DELETE FROM trip_media_references WHERE trip_id=?").bind(tripId),
    ...referencedMediaIds.map((mediaId) =>
      env.DB.prepare("INSERT INTO trip_media_references(trip_id,media_id,created_at) VALUES(?,?,?)").bind(tripId, mediaId, now)
    ),
    ...referencedMediaIds.map((mediaId) =>
      env.DB.prepare("INSERT OR IGNORE INTO media_tags(media_id,tag_id) VALUES(?,?)").bind(mediaId, storyTagId)
    ),
  ]);
  await env.DB.prepare(
    `DELETE FROM trip_versions WHERE id IN (
      SELECT id FROM trip_versions WHERE trip_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 5
    )`
  ).bind(tripId).run();
  await env.DB.prepare(
    `DELETE FROM media_tags WHERE tag_id=? AND media_id NOT IN (
      SELECT DISTINCT media_id FROM trip_media_references
    )`
  ).bind(storyTagId).run();
  await writeAudit(env, user.id, "trip.version.restore", "trip", tripId, { versionId });
  return json({ ok: true });
}

async function rotateShareToken(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(id).first();
  if (!trip) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  if (trip.visibility !== "link") return json({ error: "link_visibility_required" }, 409);
  const token = randomToken();
  await env.DB.prepare("UPDATE trips SET share_token_hash=?,updated_at=? WHERE id=?")
    .bind(await sha256(token), Date.now(), id).run();
  await writeAudit(env, user.id, "trip.share.rotate", "trip", id);
  return json({ shareToken: token });
}

async function listTripMedia(request, env, url) {
  const tripId = pathSegment(url, 3);
  const user = await currentUser(request, env);
  const shareHash = url.searchParams.get("share") ? await sha256(url.searchParams.get("share")) : "";
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(tripId).first();
  if (!trip || !(await canViewTrip(trip, user, shareHash))) return json({ error: "trip_not_found" }, 404);
  const manage = canManageTrip(trip, user);
  const order = url.searchParams.get("sort");
  const orderSql = order === "time"
    ? "m.captured_at ASC,m.created_at ASC"
    : order === "manual" && manage
      ? "m.sort_manual ASC,m.created_at ASC"
      : order === "smart" && manage
        ? "COALESCE(m.sort_smart,m.sort_manual) ASC,m.created_at ASC"
        : "m.sort_manual ASC,m.created_at ASC";
  const rows = await env.DB.prepare(
    `SELECT m.id,m.trip_id,m.place_id,m.uploader_id,m.kind,m.original_filename,m.mime_type,m.byte_size,
            m.width,m.height,m.duration_ms,m.captured_at,m.date_status,m.district_code,m.description,
            m.sort_manual,m.sort_smart,m.sort_time,m.status,m.deleted_at,m.purge_after,m.created_at,m.updated_at,
            p.display_name AS place_name,
            (SELECT COUNT(*) FROM likes l WHERE l.media_id=m.id) AS like_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.media_id=m.id AND l.user_id=?2) AS liked,
            EXISTS(SELECT 1 FROM favorites f WHERE f.media_id=m.id AND f.user_id=?2) AS favorited,
            EXISTS(SELECT 1 FROM trip_media_references r WHERE r.media_id=m.id) AS story_referenced
       FROM media m JOIN places p ON p.id=m.place_id
      WHERE m.trip_id=?1 AND (m.status!='trash' OR ?3=1)
      ORDER BY ${orderSql} LIMIT 600`
  ).bind(tripId, user?.id || "", manage ? 1 : 0).all();
  const tagRows = rows.results.length
    ? await env.DB.prepare(
        `SELECT mt.media_id,t.id,t.name,t.color,t.is_system
           FROM media_tags mt JOIN tags t ON t.id=mt.tag_id
          WHERE mt.media_id IN (${rows.results.map(() => "?").join(",")})
          ORDER BY t.is_system DESC,t.name COLLATE NOCASE`
      ).bind(...rows.results.map((row) => row.id)).all()
    : { results: [] };
  const tagsByMedia = new Map();
  tagRows.results.forEach((tag) => {
    if (!tagsByMedia.has(tag.media_id)) tagsByMedia.set(tag.media_id, []);
    tagsByMedia.get(tag.media_id).push({ id: tag.id, name: tag.name, color: tag.color, is_system: tag.is_system });
  });
  return json({
    media: rows.results.map((row) => ({
      ...row,
      liked: Boolean(row.liked),
      favorited: Boolean(row.favorited),
      story_referenced: Boolean(row.story_referenced),
      tags: tagsByMedia.get(row.id) || [],
      content_url: `/api/media/${encodeURIComponent(row.id)}/content`,
    })),
    can_edit: manage,
  });
}

async function updateMediaOrder(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const tripId = pathSegment(url, 3);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(tripId).first();
  if (!trip) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  const body = await readJson(request);
  const mediaIds = normalizeIdList(body.mediaIds, 500);
  if (!mediaIds) return json({ error: "invalid_media_order" }, 400);
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM media WHERE trip_id=? AND status!='trash'`
  ).bind(tripId).first();
  if (Number(count.count) !== mediaIds.length) return json({ error: "incomplete_media_order" }, 409);
  if (mediaIds.length) {
    const placeholders = mediaIds.map(() => "?").join(",");
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM media WHERE trip_id=? AND id IN (${placeholders}) AND status!='trash'`
    ).bind(tripId, ...mediaIds).first();
    if (Number(owned.count) !== mediaIds.length) return json({ error: "invalid_media_order" }, 400);
  }
  await env.DB.batch(mediaIds.map((mediaId, index) =>
    env.DB.prepare("UPDATE media SET sort_manual=?,updated_at=? WHERE id=?").bind(index, Date.now(), mediaId)
  ));
  await writeAudit(env, user.id, "media.reorder", "trip", tripId, { count: mediaIds.length });
  return json({ ok: true });
}

async function calculateSmartSort(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const tripId = pathSegment(url, 3);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status!='trash'").bind(tripId).first();
  if (!trip) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  const rows = await env.DB.prepare(
    `SELECT id,visual_fingerprint,captured_at,sort_manual FROM media
      WHERE trip_id=? AND status='ready'
      ORDER BY captured_at ASC,sort_manual ASC`
  ).bind(tripId).all();
  const parsed = rows.results.map((row) => {
    try {
      const value = JSON.parse(row.visual_fingerprint || "{}");
      return /^[0-9a-f]{16}$/i.test(value.d) && Number.isFinite(value.h)
        ? { ...row, hash: BigInt(`0x${value.d}`), hue: Number(value.h) }
        : { ...row, hash: null, hue: null };
    } catch {
      return { ...row, hash: null, hue: null };
    }
  });
  const withFeatures = parsed.filter((item) => item.hash !== null);
  const withoutFeatures = parsed.filter((item) => item.hash === null);
  const ordered = [];
  if (withFeatures.length) {
    ordered.push(withFeatures.shift());
    while (withFeatures.length) {
      const previous = ordered[ordered.length - 1];
      let bestIndex = 0;
      let bestScore = Infinity;
      withFeatures.forEach((candidate, index) => {
        const structure = hamming64(previous.hash, candidate.hash) / 64;
        const hue = Math.min(Math.abs(previous.hue - candidate.hue), 360 - Math.abs(previous.hue - candidate.hue)) / 180;
        const score = structure * 0.82 + hue * 0.18;
        if (score < bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      ordered.push(withFeatures.splice(bestIndex, 1)[0]);
    }
  }
  ordered.push(...withoutFeatures);
  if (ordered.length) {
    await env.DB.batch(ordered.map((item, index) =>
      env.DB.prepare("UPDATE media SET sort_smart=?,updated_at=? WHERE id=?").bind(index, Date.now(), item.id)
    ));
  }
  await writeAudit(env, user.id, "media.smart_sort", "trip", tripId, {
    count: ordered.length,
    model: "dhash-structure-82+hue-18",
    faceIdentity: false,
  });
  return json({ ok: true, count: ordered.length });
}

function hamming64(left, right) {
  let value = left ^ right;
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

async function updateMedia(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const media = await env.DB.prepare(
    "SELECT m.*,t.author_id FROM media m JOIN trips t ON t.id=m.trip_id WHERE m.id=? AND m.status!='trash'"
  ).bind(id).first();
  if (!media) return json({ error: "media_not_found" }, 404);
  if (user.role !== "admin" && media.author_id !== user.id) return json({ error: "forbidden" }, 403);
  const body = await readJson(request);
  const description = body.description === undefined ? media.description : cleanText(body.description, 2000);
  const capturedAt = body.capturedAt === undefined ? media.captured_at : normalizeCapturedAt(body.capturedAt);
  if (capturedAt === "") return json({ error: "invalid_capture_time" }, 400);
  const dateStatus = body.dateStatus === undefined
    ? media.date_status
    : (["valid", "pending", "corrected"].includes(body.dateStatus) ? body.dateStatus : "");
  if (!dateStatus) return json({ error: "invalid_date_status" }, 400);
  const placeId = body.placeId === undefined ? media.place_id : cleanText(body.placeId, 80);
  const place = await env.DB.prepare(
    `SELECT p.id FROM places p JOIN trip_places tp ON tp.place_id=p.id
      WHERE p.id=? AND tp.trip_id=?`
  ).bind(placeId, media.trip_id).first();
  if (!place) return json({ error: "place_not_in_trip" }, 409);
  const sortManual = body.sortManual === undefined ? media.sort_manual : Number(body.sortManual);
  if (!Number.isInteger(sortManual) || sortManual < 0 || sortManual > 1_000_000) {
    return json({ error: "invalid_sort" }, 400);
  }
  const tagIds = body.tagIds === undefined ? null : normalizeIdList(body.tagIds, 30);
  if (tagIds === null) return json({ error: "invalid_tag" }, 400);
  if (tagIds) {
    const relationError = await validateTripRelations(env, [], tagIds);
    if (relationError) return json({ error: relationError }, 400);
  }
  const now = Date.now();
  const statements = [
    env.DB.prepare(
      `UPDATE media SET description=?,captured_at=?,date_status=?,place_id=?,sort_manual=?,updated_at=? WHERE id=?`
    ).bind(description, capturedAt, dateStatus, placeId, sortManual, now, id),
  ];
  if (tagIds) {
    statements.push(env.DB.prepare("DELETE FROM media_tags WHERE media_id=? AND tag_id!='system-story'").bind(id));
    statements.push(...tagIds.filter((tagId) => tagId !== "system-story").map((tagId) =>
      env.DB.prepare("INSERT OR IGNORE INTO media_tags(media_id,tag_id) VALUES(?,?)").bind(id, tagId)
    ));
  }
  await env.DB.batch(statements);
  await recalculateTripDates(env, media.trip_id);
  await writeAudit(env, user.id, "media.update", "media", id, { placeId, dateStatus });
  return json({ ok: true });
}

async function trashMedia(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const media = await env.DB.prepare(
    "SELECT m.*,t.author_id FROM media m JOIN trips t ON t.id=m.trip_id WHERE m.id=? AND m.status!='trash'"
  ).bind(id).first();
  if (!media) return json({ error: "media_not_found" }, 404);
  if (user.role !== "admin" && media.author_id !== user.id) return json({ error: "forbidden" }, 403);
  const reference = await env.DB.prepare("SELECT COUNT(*) AS count FROM trip_media_references WHERE media_id=?").bind(id).first();
  if (Number(reference?.count || 0) && url.searchParams.get("force") !== "1") {
    return json({ error: "media_referenced_by_story", referenced: true }, 409);
  }
  const now = Date.now();
  const purgeAfter = now + 30 * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    "UPDATE media SET deleted_from_status=status,status='trash',deleted_at=?,purge_after=?,updated_at=? WHERE id=?"
  )
    .bind(now, purgeAfter, now, id).run();
  await recalculateTripDates(env, media.trip_id);
  await writeAudit(env, user.id, "media.trash", "media", id, { purgeAfter });
  return json({ ok: true, purgeAfter });
}

async function restoreMedia(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const media = await env.DB.prepare(
    "SELECT m.*,t.author_id,t.status AS trip_status FROM media m JOIN trips t ON t.id=m.trip_id WHERE m.id=?"
  ).bind(id).first();
  if (!media || media.status !== "trash" || !media.deleted_from_status || media.purge_after <= Date.now()) {
    return json({ error: "media_not_found" }, 404);
  }
  if (user.role !== "admin" && media.author_id !== user.id) return json({ error: "forbidden" }, 403);
  if (media.trip_status === "trash") return json({ error: "trip_in_trash" }, 409);
  await env.DB.prepare(
    "UPDATE media SET status=COALESCE(deleted_from_status,'ready'),deleted_from_status=NULL,deleted_at=NULL,purge_after=NULL,updated_at=? WHERE id=?"
  ).bind(Date.now(), id).run();
  await recalculateTripDates(env, media.trip_id);
  await writeAudit(env, user.id, "media.restore", "media", id);
  return json({ ok: true });
}

async function toggleMediaReaction(request, env, url, table) {
  const user = await requireRole(request, env, ["visitor", "editor", "admin"]);
  if (user instanceof Response) return user;
  const parts = url.pathname.split("/");
  const id = decodeURIComponent(parts[3]);
  const media = await env.DB.prepare(
    "SELECT m.id,t.* FROM media m JOIN trips t ON t.id=m.trip_id WHERE m.id=? AND m.status='ready'"
  ).bind(id).first();
  const shareHash = url.searchParams.get("share") ? await sha256(url.searchParams.get("share")) : "";
  if (!media || !(await canViewTrip(media, user, shareHash))) return json({ error: "media_not_found" }, 404);
  const existing = await env.DB.prepare(`SELECT 1 FROM ${table} WHERE user_id=? AND media_id=?`).bind(user.id, id).first();
  const body = await readJson(request);
  const active = typeof body.active === "boolean" ? body.active : !existing;
  if (active && !existing) {
    await env.DB.prepare(`INSERT INTO ${table}(user_id,media_id,created_at) VALUES(?,?,?)`).bind(user.id, id, Date.now()).run();
  } else if (!active && existing) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE user_id=? AND media_id=?`).bind(user.id, id).run();
  }
  const count = table === "likes"
    ? Number((await env.DB.prepare("SELECT COUNT(*) AS count FROM likes WHERE media_id=?").bind(id).first()).count)
    : undefined;
  return json({ active, count });
}

async function listMediaLikes(request, env, url) {
  const user = await requireRole(request, env, ["admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const rows = await env.DB.prepare(
    `SELECT u.id,u.nickname,u.email,l.created_at
       FROM likes l JOIN users u ON u.id=l.user_id
      WHERE l.media_id=? ORDER BY l.created_at DESC`
  ).bind(id).all();
  return json({ users: rows.results });
}

async function listFavorites(request, env) {
  const user = await requireRole(request, env, ["visitor", "editor", "admin"]);
  if (user instanceof Response) return user;
  const rows = await env.DB.prepare(
    `SELECT m.id,m.kind,m.description,m.captured_at,m.web_key,m.thumb_key,m.original_filename,
            p.display_name AS place_name,t.id AS trip_id,t.title AS trip_title,
            (SELECT COUNT(*) FROM likes l WHERE l.media_id=m.id) AS like_count
       FROM favorites f
       JOIN media m ON m.id=f.media_id
       JOIN trips t ON t.id=m.trip_id
       JOIN places p ON p.id=m.place_id
      WHERE f.user_id=?1 AND m.status='ready' AND t.status='published'
        AND (t.visibility='public' OR ?2='admin' OR t.author_id=?1)
      ORDER BY f.created_at DESC LIMIT 500`
  ).bind(user.id, user.role).all();
  return json({
    media: rows.results.map((row) => ({
      ...row,
      content_url: `/api/media/${encodeURIComponent(row.id)}/content`,
    })),
  });
}

async function serveMediaContent(request, env, url) {
  const id = pathSegment(url, 3);
  const user = await currentUser(request, env);
  const media = await env.DB.prepare(
    "SELECT m.*,t.author_id,t.visibility,t.status AS trip_status,t.share_token_hash FROM media m JOIN trips t ON t.id=m.trip_id WHERE m.id=?"
  ).bind(id).first();
  if (!media || media.status !== "ready") return json({ error: "media_not_found" }, 404);
  const shareHash = url.searchParams.get("share") ? await sha256(url.searchParams.get("share")) : "";
  const tripView = { ...media, status: media.trip_status };
  if (!(await canViewTrip(tripView, user, shareHash))) return json({ error: "media_not_found" }, 404);
  const download = url.searchParams.get("download") === "1";
  const ownsOriginal = user && (user.role === "admin" || user.id === media.uploader_id);
  if (download && !user) return json({ error: "authentication_required" }, 401);
  const key = ownsOriginal ? media.original_key : (download ? media.safe_key : media.web_key);
  if (!key) return json({ error: "preview_processing" }, 409);
  const object = request.headers.has("range")
    ? await env.MEDIA.get(key, { range: request.headers })
    : await env.MEDIA.get(key);
  if (!object) return json({ error: "media_not_found" }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", ownsOriginal ? "private, no-store" : "private, max-age=300");
  headers.set("content-disposition", `${download ? "attachment" : "inline"}; filename="${sanitizeFilename(media.original_filename)}"`);
  return new Response(object.body, { status: request.headers.has("range") ? 206 : 200, headers });
}

async function uploadMediaVariant(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const parts = url.pathname.split("/");
  const mediaId = decodeURIComponent(parts[3]);
  const variant = parts[5];
  const media = await env.DB.prepare(
    "SELECT m.*,t.author_id FROM media m JOIN trips t ON t.id=m.trip_id WHERE m.id=? AND m.status!='trash'"
  ).bind(mediaId).first();
  if (!media) return json({ error: "media_not_found" }, 404);
  if (user.role !== "admin" && media.author_id !== user.id) return json({ error: "forbidden" }, 403);
  if ((media.kind === "image" && variant === "poster") || (media.kind === "video" && variant !== "poster")) {
    return json({ error: "invalid_variant" }, 400);
  }
  if (!request.body) return json({ error: "empty_variant" }, 400);
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (!["image/jpeg", "image/webp"].includes(contentType)) return json({ error: "invalid_variant_type" }, 400);
  const size = Number(request.headers.get("content-length"));
  const limit = variant === "thumb" ? 1024 * 1024 : variant === "safe" ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!Number.isInteger(size) || size < 1 || size > limit) return json({ error: "invalid_variant_size" }, 400);
  const keyColumn = `${variant}_key`;
  const sizeColumn = `${variant}_byte_size`;
  const previousSize = Number(media[sizeColumn] || 0);
  const reserved = Math.max(0, size - previousSize);
  const hardLimit = Number(env.STORAGE_HARD_LIMIT_BYTES || 9663676416);
  if (reserved) {
    const reservation = await env.DB.prepare(
      `UPDATE storage_usage SET reserved_bytes=reserved_bytes+?,updated_at=?
        WHERE singleton=1 AND total_bytes+reserved_bytes+?<=?`
    ).bind(reserved, Date.now(), reserved, hardLimit).run();
    if (Number(reservation.meta?.changes || 0) !== 1) return json({ error: "storage_limit_reached" }, 507);
  }
  const key = `${variant}/${media.trip_id}/${media.id}/${variant}.${contentType === "image/webp" ? "webp" : "jpg"}`;
  let object;
  try {
    object = await env.MEDIA.put(key, request.body, {
      httpMetadata: { contentType, contentDisposition: "inline" },
      customMetadata: { mediaId, variant },
    });
  } catch (error) {
    if (reserved) await releaseStorageReservation(env, reserved);
    throw error;
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE media SET ${keyColumn}=?,${sizeColumn}=?,updated_at=? WHERE id=?`)
      .bind(key, object.size, now, mediaId),
    env.DB.prepare(
      "UPDATE storage_usage SET total_bytes=MAX(0,total_bytes+?),reserved_bytes=MAX(0,reserved_bytes-?),updated_at=? WHERE singleton=1"
    ).bind(object.size - previousSize, reserved, now),
  ]);
  if (media[keyColumn] && media[keyColumn] !== key) await env.MEDIA.delete(media[keyColumn]);
  await maybeSendStorageAlert(env);
  return json({ ok: true, variant, byteSize: object.size });
}

async function searchContent(request, env, url) {
  const user = await currentUser(request, env);
  const query = cleanText(url.searchParams.get("q"), 120);
  if (query.length < 2) return json({ results: [] });
  const like = `%${query}%`;
  const rows = await env.DB.prepare(
    `SELECT DISTINCT t.id,t.slug,t.title,t.subtitle,t.start_date,t.end_date,t.visibility,t.author_id,
            substr(t.markdown,1,260) AS excerpt,t.updated_at
       FROM trips t
       LEFT JOIN trip_places tp ON tp.trip_id=t.id
       LEFT JOIN places p ON p.id=tp.place_id
       LEFT JOIN trip_tags tt ON tt.trip_id=t.id
       LEFT JOIN tags tg ON tg.id=tt.tag_id
       LEFT JOIN media m ON m.trip_id=t.id AND m.status='ready'
       LEFT JOIN media_tags mt ON mt.media_id=m.id
       LEFT JOIN tags mg ON mg.id=mt.tag_id
      WHERE t.status='published'
        AND (t.visibility='public' OR (?1 IS NOT NULL AND (?2='admin' OR t.author_id=?1)))
        AND (t.title LIKE ?3 OR t.subtitle LIKE ?3 OR t.markdown LIKE ?3 OR t.start_date LIKE ?3
          OR t.end_date LIKE ?3 OR p.display_name LIKE ?3 OR p.official_name LIKE ?3
          OR tg.name LIKE ?3 OR m.description LIKE ?3 OR mg.name LIKE ?3)
      ORDER BY t.start_date DESC,t.updated_at DESC LIMIT 50`
  ).bind(user?.id || null, user?.role || null, like).all();
  return json({ results: rows.results });
}

async function exportData(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const rows = await env.DB.prepare(
    `SELECT t.id,t.slug,t.title,t.subtitle,t.start_date,t.end_date,t.visibility,t.status,t.markdown,t.created_at,t.updated_at
       FROM trips t WHERE t.status!='trash' AND (?1='admin' OR t.author_id=?2)
       ORDER BY t.start_date DESC,t.created_at DESC`
  ).bind(user.role, user.id).all();
  await writeAudit(env, user.id, "data.export", "account", user.id, { format: url.searchParams.get("format") || "json" });
  if (url.searchParams.get("format") === "csv") {
    const columns = ["id","slug","title","subtitle","start_date","end_date","visibility","status","markdown","created_at","updated_at"];
    const csv = [columns.join(","), ...rows.results.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=travel-rolls.csv" },
    });
  }
  return new Response(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), trips: rows.results }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=travel-rolls.json" },
  });
}

async function listTrash(request, env) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const [trips, media] = await Promise.all([
    env.DB.prepare(
      `SELECT id,title,deleted_from_status,deleted_at,purge_after
         FROM trips WHERE status='trash' AND (?='admin' OR author_id=?)
        ORDER BY deleted_at DESC LIMIT 200`
    ).bind(user.role, user.id).all(),
    env.DB.prepare(
      `SELECT m.id,m.original_filename,m.kind,m.deleted_from_status,m.deleted_at,m.purge_after,t.title AS trip_title
         FROM media m JOIN trips t ON t.id=m.trip_id
        WHERE m.status='trash' AND m.deleted_from_status IS NOT NULL
          AND (?='admin' OR t.author_id=?)
        ORDER BY m.deleted_at DESC LIMIT 500`
    ).bind(user.role, user.id).all(),
  ]);
  return json({ trips: trips.results, media: media.results });
}

async function restoreTrip(request, env, url) {
  const user = await requireRole(request, env, ["editor", "admin"]);
  if (user instanceof Response) return user;
  const id = pathSegment(url, 3);
  const trip = await env.DB.prepare("SELECT * FROM trips WHERE id=? AND status='trash'").bind(id).first();
  if (!trip || !trip.deleted_from_status || trip.purge_after <= Date.now()) return json({ error: "trip_not_found" }, 404);
  if (!canManageTrip(trip, user)) return json({ error: "forbidden" }, 403);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE trips SET status=deleted_from_status,deleted_from_status=NULL,deleted_at=NULL,purge_after=NULL,updated_at=?
        WHERE id=?`
    ).bind(now, id),
    env.DB.prepare(
      `UPDATE media SET status=COALESCE(deleted_from_status,'ready'),deleted_from_status=NULL,
              deleted_at=NULL,purge_after=NULL,updated_at=?
        WHERE trip_id=? AND status='trash' AND deleted_at=? AND deleted_from_status IS NOT NULL`
    ).bind(now, id, trip.deleted_at),
  ]);
  await recalculateTripDates(env, id);
  await writeAudit(env, user.id, "trip.restore", "trip", id);
  return json({ ok: true });
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
  const reservation = await env.DB.prepare(
    `UPDATE storage_usage SET reserved_bytes=reserved_bytes+?,updated_at=?
      WHERE singleton=1 AND total_bytes+reserved_bytes+?<=?`
  ).bind(body.byteSize, Date.now(), body.byteSize, hardLimit).run();
  if (Number(reservation.meta?.changes || 0) !== 1) return json({ error: "storage_limit_reached" }, 507);

  const now = Date.now();
  const contentHash = typeof body.contentHash === "string" && /^[0-9a-f]{64}$/i.test(body.contentHash)
    ? body.contentHash.toLowerCase()
    : null;
  if (contentHash) {
    const duplicate = await env.DB.prepare(
      "SELECT id,original_filename FROM media WHERE uploader_id=? AND content_hash=? AND status!='trash'"
    ).bind(user.id, contentHash).first();
    if (duplicate) return json({ error: "exact_duplicate", duplicateMediaId: duplicate.id, filename: duplicate.original_filename }, 409);
  }
  const capturedAt = normalizeCapturedAt(body.capturedAt);
  if (capturedAt === "") return json({ error: "invalid_capture_time" }, 400);
  const dateStatus = capturedAt ? "valid" : "pending";
  const districtCode = body.districtCode === null || body.districtCode === undefined || body.districtCode === ""
    ? null
    : (/^\d{6}$/.test(String(body.districtCode)) ? String(body.districtCode) : "");
  if (districtCode === "") return json({ error: "invalid_district_code" }, 400);
  const visualFingerprint = typeof body.visualFingerprint === "string"
    ? cleanText(body.visualFingerprint, 500)
    : null;
  const mediaId = crypto.randomUUID();
  const uploadId = crypto.randomUUID();
  const safeName = sanitizeFilename(body.filename || `upload.${mediaType.ext}`);
  const objectKey = `original/${body.tripId}/${mediaId}/${safeName}`;
  let multipart;
  try {
    multipart = await env.MEDIA.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: body.mimeType, contentDisposition: `attachment; filename="${safeName}"` },
      customMetadata: { mediaId, uploaderId: user.id },
    });
  } catch (error) {
    await releaseStorageReservation(env, body.byteSize);
    throw error;
  }
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO media(
          id,trip_id,place_id,uploader_id,kind,original_key,original_filename,mime_type,byte_size,
          captured_at,date_status,district_code,content_hash,visual_fingerprint,status,created_at,updated_at
         ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'uploading',?,?)`
      ).bind(
        mediaId, body.tripId, body.placeId, user.id, mediaType.kind, objectKey, safeName, body.mimeType,
        body.byteSize, capturedAt, dateStatus, districtCode, contentHash, visualFingerprint, now, now
      ),
      env.DB.prepare(
        `INSERT INTO media_uploads(id,media_id,r2_upload_id,object_key,expected_size,part_size,status,expires_at,created_at)
         VALUES(?,?,?,?,?,?,'active',?,?)`
      ).bind(uploadId, mediaId, multipart.uploadId, objectKey, body.byteSize, 8 * 1024 * 1024, now + 24 * 60 * 60 * 1000, now),
    ]);
  } catch (error) {
    await multipart.abort().catch(() => {});
    await releaseStorageReservation(env, body.byteSize);
    const message = String(error);
    if (message.includes("city_limit_reached")) return json({ error: "city_limit_reached" }, 409);
    if (message.includes("media_exact_duplicate_idx") || message.includes("UNIQUE constraint failed: media.uploader_id, media.content_hash")) {
      return json({ error: "exact_duplicate" }, 409);
    }
    throw error;
  }
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
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE media_uploads SET status='aborted' WHERE id=?").bind(uploadId),
      env.DB.prepare("UPDATE media SET status='trash',deleted_at=?,purge_after=?,updated_at=? WHERE id=?")
        .bind(now, now + 30 * 24 * 60 * 60 * 1000, now, upload.media_id),
      env.DB.prepare("UPDATE storage_usage SET reserved_bytes=MAX(0,reserved_bytes-?),updated_at=? WHERE singleton=1")
        .bind(upload.expected_size, now),
    ]);
    return json({ error: "size_mismatch" }, 400);
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE media_uploads SET status='completed' WHERE id=?").bind(uploadId),
    env.DB.prepare("UPDATE media SET status='ready',updated_at=? WHERE id=?").bind(now, upload.media_id),
    env.DB.prepare(
      "UPDATE storage_usage SET total_bytes=total_bytes+?,reserved_bytes=MAX(0,reserved_bytes-?),updated_at=? WHERE singleton=1"
    ).bind(object.size, upload.expected_size, now),
  ]);
  const media = await env.DB.prepare("SELECT trip_id FROM media WHERE id=?").bind(upload.media_id).first();
  if (media) await recalculateTripDates(env, media.trip_id);
  await writeAudit(env, user.id, "media.upload.complete", "media", upload.media_id, { bytes: object.size });
  await maybeSendStorageAlert(env);
  return json({ ok: true, mediaId: upload.media_id, status: "ready" });
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
    env.DB.prepare("UPDATE storage_usage SET reserved_bytes=MAX(0,reserved_bytes-?),updated_at=? WHERE singleton=1")
      .bind(upload.expected_size, now),
  ]);
  return json({ ok: true });
}

async function ownedUpload(env, uploadId, user) {
  return env.DB.prepare(
    `SELECT mu.*,m.uploader_id FROM media_uploads mu JOIN media m ON m.id=mu.media_id
      WHERE mu.id=? AND mu.status='active' AND mu.expires_at>? AND (m.uploader_id=? OR ?='admin')`
  ).bind(uploadId, Date.now(), user.id, user.role).first();
}

function pathSegment(url, index) {
  const value = url.pathname.split("/")[index];
  return value ? decodeURIComponent(value) : "";
}

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\u0000/g, "").slice(0, maxLength);
}

function normalizeColor(value) {
  const color = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : "";
}

async function ensureStoryTag(env, userId) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO tags(id,name,color,is_system,created_by,created_at,updated_at)
     VALUES('system-story','游记','#b44b34',1,?,?,?)
     ON CONFLICT(name) DO NOTHING`
  ).bind(userId, now, now).run();
  const tag = await env.DB.prepare("SELECT id,is_system FROM tags WHERE name='游记' COLLATE NOCASE").first();
  if (!tag.is_system) {
    await env.DB.prepare("UPDATE tags SET is_system=1,updated_at=? WHERE id=?").bind(now, tag.id).run();
  }
  return tag.id;
}

function extractReferencedMediaIds(markdown) {
  const ids = new Set();
  const source = String(markdown || "");
  for (const match of source.matchAll(/(?:media:|\/api\/media\/)([0-9a-z-]{8,80})(?:\/content)?/gi)) {
    ids.add(match[1]);
    if (ids.size >= 200) break;
  }
  return [...ids];
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : "";
}

function normalizeCapturedAt(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  const time = Date.parse(text);
  return Number.isNaN(time) ? "" : new Date(time).toISOString();
}

async function recalculateTripDates(env, tripId) {
  const trip = await env.DB.prepare("SELECT date_source FROM trips WHERE id=?").bind(tripId).first();
  if (!trip || trip.date_source !== "auto") return;
  const dates = await env.DB.prepare(
    `SELECT MIN(substr(captured_at,1,10)) AS start_date,MAX(substr(captured_at,1,10)) AS end_date
       FROM media
      WHERE trip_id=? AND status='ready' AND date_status IN ('valid','corrected') AND captured_at IS NOT NULL`
  ).bind(tripId).first();
  await env.DB.prepare("UPDATE trips SET start_date=?,end_date=?,updated_at=? WHERE id=?")
    .bind(dates?.start_date || null, dates?.end_date || null, Date.now(), tripId).run();
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeIdList(value, max = 30) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result = [...new Set(value.map((entry) => cleanText(entry, 80)).filter(Boolean))];
  return result.length <= max ? result : null;
}

function normalizeTripInput(body) {
  const title = cleanText(body.title, 120);
  const subtitle = cleanText(body.subtitle, 240);
  const markdown = typeof body.markdown === "string" ? body.markdown.slice(0, 500_000) : "";
  const startDate = normalizeDate(body.startDate);
  const endDate = normalizeDate(body.endDate);
  const visibility = ["public", "link", "private"].includes(body.visibility) ? body.visibility : "";
  const status = ["draft", "published"].includes(body.status) ? body.status : "";
  const dateSource = ["auto", "manual"].includes(body.dateSource || "auto") ? (body.dateSource || "auto") : "";
  const placeIds = normalizeIdList(body.placeIds, 20);
  const tagIds = normalizeIdList(body.tagIds, 30);
  if (!title) return { error: "title_required" };
  if (startDate === "" || endDate === "") return { error: "invalid_date" };
  if (startDate && endDate && startDate > endDate) return { error: "invalid_date_range" };
  if (!visibility) return { error: "invalid_visibility" };
  if (!status || !dateSource) return { error: "invalid_status" };
  if (!placeIds || !tagIds) return { error: "invalid_relations" };
  return { title, subtitle, markdown, startDate, endDate, visibility, status, dateSource, placeIds, tagIds };
}

async function validateTripRelations(env, placeIds, tagIds) {
  if (placeIds.length) {
    const placeholders = placeIds.map(() => "?").join(",");
    const result = await env.DB.prepare(`SELECT COUNT(*) AS count FROM places WHERE id IN (${placeholders})`)
      .bind(...placeIds).first();
    if (result.count !== placeIds.length) return "invalid_place";
  }
  if (tagIds.length) {
    const placeholders = tagIds.map(() => "?").join(",");
    const result = await env.DB.prepare(`SELECT COUNT(*) AS count FROM tags WHERE id IN (${placeholders})`)
      .bind(...tagIds).first();
    if (result.count !== tagIds.length) return "invalid_tag";
  }
  return "";
}

function tripRelationStatements(env, tripId, placeIds = [], tagIds = []) {
  return [
    ...placeIds.map((placeId, position) =>
      env.DB.prepare("INSERT INTO trip_places(trip_id,place_id,position) VALUES(?,?,?)")
        .bind(tripId, placeId, position)
    ),
    ...tagIds.map((tagId) =>
      env.DB.prepare("INSERT INTO trip_tags(trip_id,tag_id) VALUES(?,?)").bind(tripId, tagId)
    ),
  ];
}

async function uniqueSlug(env, value, id) {
  const base = cleanText(value, 80)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || `roll-${id.slice(0, 8)}`;
  let slug = base;
  let counter = 1;
  while (await env.DB.prepare("SELECT 1 FROM trips WHERE slug=?").bind(slug).first()) {
    slug = `${base.slice(0, 48)}-${counter}`;
    counter += 1;
  }
  return slug;
}

function canManageTrip(trip, user) {
  return Boolean(user && (user.role === "admin" || trip.author_id === user.id));
}

async function canViewTrip(trip, user, shareHash) {
  if (canManageTrip(trip, user)) return true;
  if (trip.status !== "published") return false;
  if (trip.visibility === "public") return true;
  return Boolean(trip.visibility === "link" && shareHash && trip.share_token_hash === shareHash);
}

async function enrichTrip(env, trip, user) {
  const [places, tags, counts] = await Promise.all([
    env.DB.prepare(
      `SELECT p.id,p.province_code,p.city_code,p.official_name,p.display_name,p.level,p.center_lat,p.center_lng,tp.position
         FROM trip_places tp JOIN places p ON p.id=tp.place_id
        WHERE tp.trip_id=? ORDER BY tp.position`
    ).bind(trip.id).all(),
    env.DB.prepare(
      `SELECT t.id,t.name,t.color,t.is_system
         FROM trip_tags tt JOIN tags t ON t.id=tt.tag_id
        WHERE tt.trip_id=? ORDER BY t.is_system DESC,t.name COLLATE NOCASE`
    ).bind(trip.id).all(),
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM media WHERE trip_id=?1 AND status!='trash') AS media_count,
        (SELECT COUNT(*) FROM trip_versions WHERE trip_id=?1) AS version_count`
    ).bind(trip.id).first(),
  ]);
  const result = {
    ...trip,
    share_token_hash: undefined,
    places: places.results,
    tags: tags.results,
    media_count: counts.media_count,
    version_count: counts.version_count,
    can_edit: canManageTrip(trip, user),
  };
  delete result.share_token_hash;
  return result;
}

async function writeAudit(env, actorId, action, targetType, targetId = null, detail = {}) {
  await env.DB.prepare(
    "INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,detail_json,created_at) VALUES(?,?,?,?,?,?,?)"
  ).bind(
    crypto.randomUUID(), actorId || null, action, targetType, targetId,
    JSON.stringify(detail).slice(0, 4000), Date.now()
  ).run();
}

async function sendEmail(env, { to, subject, text, idempotencyKey }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !to) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        "user-agent": "travel-rolls/1.0",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
    });
    if (!response.ok) console.error("email_failed", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("email_failed", error);
    return false;
  }
}

async function maybeSendStorageAlert(env) {
  const [usage, state] = await Promise.all([
    env.DB.prepare("SELECT total_bytes,reserved_bytes FROM storage_usage WHERE singleton=1").first(),
    env.DB.prepare("SELECT * FROM notification_state WHERE key='storage'").first(),
  ]);
  const total = Number(usage?.total_bytes || 0) + Number(usage?.reserved_bytes || 0);
  const soft = Number(env.STORAGE_SOFT_LIMIT_BYTES || 8589934592);
  const hard = Number(env.STORAGE_HARD_LIMIT_BYTES || 9663676416);
  const level = total >= hard ? 2 : total >= soft ? 1 : 0;
  const now = Date.now();
  if (!level) {
    if (state?.level) {
      await env.DB.prepare("UPDATE notification_state SET level=0,updated_at=? WHERE key='storage'").bind(now).run();
    }
    return;
  }
  const shouldSend = level > Number(state?.level || 0) || !state?.last_sent_at || state.last_sent_at < now - 7 * 24 * 60 * 60 * 1000;
  if (!shouldSend) return;
  const sent = await sendEmail(env, {
    to: normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL),
    subject: level === 2 ? "TRAVEL ROLLS 存储已达硬上限" : "TRAVEL ROLLS 存储已达 8GB 预警线",
    text: `当前对象存储统计约为 ${(total / 1024 / 1024 / 1024).toFixed(2)} GB。\n\n${level === 2 ? "新上传已停止，请清理回收站或扩容。" : "请检查管理中心并规划清理或扩容。"}\n\nhttps://travel.xbgzh.site/#admin`,
    idempotencyKey: `storage-alert/${level}/${Math.floor(now / (7 * 24 * 60 * 60 * 1000))}`,
  });
  await env.DB.prepare(
    "UPDATE notification_state SET level=?,last_sent_at=CASE WHEN ? THEN ? ELSE last_sent_at END,updated_at=? WHERE key='storage'"
  ).bind(level, sent ? 1 : 0, now, now).run();
}

async function runMaintenance(env) {
  const now = Date.now();
  const staleUploads = await env.DB.prepare(
    "SELECT * FROM media_uploads WHERE status='active' AND expires_at<=? LIMIT 100"
  ).bind(now).all();
  for (const upload of staleUploads.results) {
    try {
      await env.MEDIA.resumeMultipartUpload(upload.object_key, upload.r2_upload_id).abort();
    } catch (error) {
      console.warn("stale_upload_abort_failed", upload.id, error);
    }
  }
  if (staleUploads.results.length) {
    await env.DB.batch(staleUploads.results.flatMap((upload) => [
      env.DB.prepare("UPDATE media_uploads SET status='aborted' WHERE id=?").bind(upload.id),
      env.DB.prepare("UPDATE media SET status='trash',deleted_at=?,purge_after=?,updated_at=? WHERE id=?")
        .bind(now, now + 30 * 24 * 60 * 60 * 1000, now, upload.media_id),
      env.DB.prepare("UPDATE storage_usage SET reserved_bytes=MAX(0,reserved_bytes-?),updated_at=? WHERE singleton=1")
        .bind(upload.expected_size, now),
    ]));
  }
  const expired = await env.DB.prepare(
    `SELECT m.id,m.original_key,m.web_key,m.thumb_key,m.poster_key,m.safe_key,m.byte_size,
            m.web_byte_size,m.thumb_byte_size,m.poster_byte_size,m.safe_byte_size
       FROM media m
      WHERE m.status='trash' AND m.purge_after<=?
        AND NOT EXISTS (SELECT 1 FROM trip_media_references r WHERE r.media_id=m.id)
      LIMIT 500`
  ).bind(now).all();
  const keys = [...new Set(expired.results.flatMap((media) =>
    [media.original_key, media.web_key, media.thumb_key, media.poster_key, media.safe_key].filter(Boolean)
  ))];
  if (keys.length) await env.MEDIA.delete(keys);
  const removedBytes = expired.results.reduce((sum, media) =>
    sum + Number(media.byte_size || 0) + Number(media.web_byte_size || 0)
      + Number(media.thumb_byte_size || 0) + Number(media.poster_byte_size || 0)
      + Number(media.safe_byte_size || 0), 0);
  if (expired.results.length) {
    await env.DB.batch([
      ...expired.results.map((media) => env.DB.prepare("DELETE FROM media WHERE id=?").bind(media.id)),
      env.DB.prepare("UPDATE storage_usage SET total_bytes=MAX(0,total_bytes-?),updated_at=? WHERE singleton=1")
        .bind(removedBytes, now),
    ]);
  }
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM trips WHERE status='trash' AND purge_after<=?
        AND NOT EXISTS (SELECT 1 FROM media WHERE media.trip_id=trips.id)`
    ).bind(now),
    env.DB.prepare("DELETE FROM audit_logs WHERE created_at<?").bind(now - 366 * 24 * 60 * 60 * 1000),
    env.DB.prepare("DELETE FROM login_codes WHERE created_at<?").bind(now - 24 * 60 * 60 * 1000),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)")
      .bind(now, now - 30 * 24 * 60 * 60 * 1000),
    env.DB.prepare("DELETE FROM media_uploads WHERE status!='active' AND created_at<?").bind(now - 30 * 24 * 60 * 60 * 1000),
  ]);
  return { purgedMedia: expired.results.length, removedBytes };
}

async function releaseStorageReservation(env, bytes) {
  await env.DB.prepare(
    "UPDATE storage_usage SET reserved_bytes=MAX(0,reserved_bytes-?),updated_at=? WHERE singleton=1"
  ).bind(Number(bytes || 0), Date.now()).run();
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
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
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
