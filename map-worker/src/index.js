const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "travel-rolls-map-proxy" });
    }

    const cors = corsHeaders(request, env);
    if (!cors) return json({ error: "origin_not_allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/config" && request.method === "GET") {
      const response = env.AMAP_JS_KEY
        ? json({ amapKey: env.AMAP_JS_KEY })
        : json({ error: "map_config_not_ready" }, 503);
      return withCors(response, cors);
    }
    if (!url.pathname.startsWith("/_AMapService/")) return withCors(json({ error: "not_found" }, 404), cors);

    try {
      return withCors(await proxyAmap(request, env, url), cors);
    } catch (error) {
      console.error("amap_proxy_failed", error);
      return withCors(json({ error: "map_upstream_unavailable" }, 502), cors);
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

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allowed = String(env.APP_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function withCors(response, cors) {
  Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
  response.headers.set("x-content-type-options", "nosniff");
  return response;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}
