import assert from "node:assert/strict";

const base = "http://127.0.0.1:8788";
const headers = {
  origin: "http://127.0.0.1:4174",
  cookie: "tr_session=local-test-session",
};

async function call(path, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : await response.text();
  assert.equal(response.status, expected, `${options.method || "GET"} ${path}: ${JSON.stringify(body)}`);
  return { response, body };
}

const me = await call("/api/me");
assert.equal(me.body.user.role, "admin");

const ensuredPlace = await call("/api/places", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    provinceCode: "440000",
    cityCode: "440100",
    officialName: "广州市",
    displayName: "广州",
    centerLat: 23.1291,
    centerLng: 113.2644,
  }),
}, 201);
assert.equal(ensuredPlace.body.place.id, "cn-440100");

const ensuredGlobalPlace = await call("/api/places", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    countryCode: "JP",
    provinceCode: "40",
    geoNameId: "1850147",
    officialName: "Tokyo",
    displayName: "Tokyo",
    centerLat: 35.6895,
    centerLng: 139.69171,
    source: "geonames",
  }),
}, 201);
assert.equal(ensuredGlobalPlace.body.place.id, "geo-jp-1850147");
assert.equal(ensuredGlobalPlace.body.place.country_code, "JP");

const tagsBefore = await call("/api/tags");
assert.ok(tagsBefore.body.tags.some((tag) => tag.name === "游记" && tag.is_system));

const tag = await call("/api/tags", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: `集成测试-${Date.now()}`, color: "#334455" }),
}, 201);

const trip = await call("/api/trips", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    title: `本地集成旅行-${Date.now()}`,
    subtitle: "自动化验证",
    startDate: null,
    endDate: null,
    dateSource: "auto",
    visibility: "public",
    status: "published",
    markdown: "# 本地集成旅行",
    placeIds: ["cn-140100", ensuredGlobalPlace.body.place.id],
    tagIds: [tag.body.tag.id],
  }),
}, 201);
const tripId = trip.body.trip.id;

const file = new Uint8Array([0xff, 0xd8, ...new Uint8Array(new BigUint64Array([BigInt(Date.now())]).buffer), 0xff, 0xd9]);
const digest = await crypto.subtle.digest("SHA-256", file);
const contentHash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
const upload = await call("/api/uploads/initiate", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    tripId,
    placeId: "cn-140100",
    filename: "local-check.jpg",
    mimeType: "image/jpeg",
    byteSize: file.byteLength,
    capturedAt: "2025-08-18T08:00:00.000Z",
    contentHash,
    visualFingerprint: JSON.stringify({ v: 1, d: "0123456789abcdef", h: 28 }),
  }),
}, 201);
const part = await call(`/api/uploads/${upload.body.uploadId}/parts/1`, {
  method: "PUT",
  headers: { "content-type": "application/octet-stream" },
  body: file,
});
await call(`/api/uploads/${upload.body.uploadId}/complete`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ parts: [{ partNumber: part.body.partNumber, etag: part.body.etag }] }),
});

const mediaId = upload.body.mediaId;
const webVariant = new Uint8Array([0xff, 0xd8, 0x77, 0x65, 0x62, 0xff, 0xd9]);
await call(`/api/media/${mediaId}/variants/web`, {
  method: "PUT",
  headers: { "content-type": "image/jpeg", "content-length": String(webVariant.byteLength) },
  body: webVariant,
});
await call(`/api/media/${mediaId}/variants/thumb`, {
  method: "PUT",
  headers: { "content-type": "image/jpeg", "content-length": String(file.byteLength) },
  body: file,
});
await call(`/api/media/${mediaId}/variants/safe`, {
  method: "PUT",
  headers: { "content-type": "image/jpeg", "content-length": String(file.byteLength) },
  body: file,
});
await call(`/api/media/${mediaId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    description: "古建集成测试照片",
    tagIds: [tag.body.tag.id],
    placeId: "cn-140100",
    capturedAt: "2025-08-18T08:00:00.000Z",
    dateStatus: "corrected",
  }),
});

const updated = await call(`/api/trips/${tripId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ markdown: `# 本地集成旅行\n\n![测试照片](media:${mediaId})` }),
});
assert.equal(updated.body.trip.start_date, "2025-08-18");
assert.ok(updated.body.trip.version_count >= 1);

const media = await call(`/api/trips/${tripId}/media`);
assert.equal(media.body.media.length, 1);
assert.equal(media.body.media[0].story_referenced, true);
assert.ok(media.body.media[0].tags.some((entry) => entry.name === "游记"));
const smartSort = await call(`/api/trips/${tripId}/smart-sort`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
assert.equal(smartSort.body.count, 1);
const publicPreview = await fetch(`${base}/api/media/${mediaId}/content`, {
  headers: { origin: "http://127.0.0.1:4174" },
});
assert.equal(publicPreview.status, 200);
assert.deepEqual(new Uint8Array(await publicPreview.arrayBuffer()), webVariant);
const ownerPreview = await fetch(`${base}/api/media/${mediaId}/content`, { headers });
assert.equal(ownerPreview.status, 200);
assert.deepEqual(new Uint8Array(await ownerPreview.arrayBuffer()), webVariant);

const like = await call(`/api/media/${mediaId}/like`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
assert.equal(like.body.active, true);
const favorite = await call(`/api/media/${mediaId}/favorite`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
assert.equal(favorite.body.active, true);
const favoriteList = await call("/api/favorites");
assert.ok(favoriteList.body.media.some((entry) => entry.id === mediaId));
const likeUsers = await call(`/api/media/${mediaId}/likes`);
assert.ok(likeUsers.body.users.some((entry) => entry.id === "admin-local"));

await call(`/api/media/${mediaId}`, { method: "DELETE" }, 409);
await call(`/api/media/${mediaId}?force=1`, { method: "DELETE" });
await call(`/api/media/${mediaId}/restore`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
const versions = await call(`/api/trips/${tripId}/versions`);
assert.ok(versions.body.versions.length >= 1);
await call(`/api/trips/${tripId}/versions/${versions.body.versions[0].id}/restore`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
const afterRestore = await call(`/api/trips/${tripId}/media`);
assert.equal(afterRestore.body.media[0].story_referenced, false);

const search = await call("/api/search?q=%E5%8F%A4%E5%BB%BA");
assert.ok(search.body.results.some((entry) => entry.id === tripId));
const map = await call("/api/map");
assert.ok(map.body.cities.some((entry) => entry.city_code === "140100"));
assert.ok(!map.body.cities.some((entry) => entry.city_code === "gn-1850147"));
assert.ok(map.body.globalCities.some((entry) => entry.city_code === "gn-1850147" && entry.country_code === "JP"));
const stats = await call("/api/stats");
assert.ok(stats.body.stats.cities >= 2);
assert.ok(stats.body.stats.images >= 1);
await call("/api/export?format=json");
await call("/api/admin/invitations", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `friend-${Date.now()}@example.com`, role: "editor" }),
}, 201);
await call("/api/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ subtitle: "以照片记录走过的经纬" }),
});

const editorHeaders = {
  origin: "http://127.0.0.1:4174",
  cookie: "tr_session=local-editor-session",
  "content-type": "application/json",
};
const forbiddenTripEdit = await fetch(`${base}/api/trips/${tripId}`, {
  method: "PATCH",
  headers: editorHeaders,
  body: JSON.stringify({ title: "不应成功" }),
});
assert.equal(forbiddenTripEdit.status, 403);
const forbiddenAdmin = await fetch(`${base}/api/admin/overview`, { headers: editorHeaders });
assert.equal(forbiddenAdmin.status, 403);
const privacySafeDownload = await fetch(`${base}/api/media/${mediaId}/content?download=1`, { headers: editorHeaders });
assert.equal(privacySafeDownload.status, 200);
await call(`/api/trips/${tripId}`, { method: "DELETE" });
const trash = await call("/api/trash");
assert.ok(trash.body.trips.some((entry) => entry.id === tripId));
await call(`/api/trips/${tripId}/restore`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

process.stdout.write(JSON.stringify({
  ok: true,
  tripId,
  mediaId,
  tested: [
    "session", "China and GeoNames place creation", "tags", "trip CRUD", "multipart R2 upload", "media metadata",
    "web, thumbnail and metadata-stripped full-size variants", "privacy-safe public preview and download", "visual smart sorting without identity recognition", "automatic trip dates", "Markdown media references", "likes and admin-only liker list", "private favorites collection",
    "trash restore", "Markdown version restore", "search", "China map and global site statistics", "export", "invitations", "settings",
    "editor ownership guard", "admin-only guard", "trip trash and restore",
  ],
}, null, 2));
