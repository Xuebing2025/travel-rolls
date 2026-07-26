const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

const now = Date.now();
let createdTrips = 0;
let invitationCreated = false;
let tagCreated = false;

function response(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("response", (result) => {
    if (result.status() >= 400) errors.push(`http ${result.status()}: ${result.url()}`);
  });

  await page.route("**/config.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: 'window.TRAVEL_ROLLS_CONFIG={amapKey:"",amapServiceHost:"",apiBase:"http://127.0.0.1:4174/mock"};',
  }));
  await page.route("**/mock/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/mock/, "");
    if (path === "/api/me") return response(route, { user: { id: "admin-1", email: "admin@example.com", nickname: "卷主", role: "admin" } });
    if (path === "/api/places") return response(route, { places: [
      { id: "cn-140100", display_name: "太原", official_name: "太原市", city_code: "140100" },
      { id: "cn-140200", display_name: "大同", official_name: "大同市", city_code: "140200" },
    ] });
    if (path === "/api/settings" && request.method() === "GET") return response(route, { settings: { subtitle: "以照片记录走过的经纬" } });
    if (path === "/api/trash") return response(route, { trips: [], media: [] });
    if (path === "/api/tags" && request.method() === "GET") return response(route, { tags: [
      { id: "tag-1", name: "古建", color: "#d66f3e", is_system: 0, trip_count: 1, media_count: 0 },
      { id: "system-story", name: "游记", color: "#b44b34", is_system: 1, trip_count: 0, media_count: 0 },
    ] });
    if (path === "/api/tags" && request.method() === "POST") {
      tagCreated = true;
      return response(route, { tag: { id: "tag-2", name: "夜景", color: "#334455" } }, 201);
    }
    if (path === "/api/trips" && url.searchParams.get("scope") === "manage") return response(route, { trips: [
      { id: "trip-1", title: "大同—太原", status: "draft", visibility: "private", media_count: 0, updated_at: now },
    ] });
    if (path === "/api/trips" && request.method() === "GET") return response(route, { trips: [] });
    if (path === "/api/trips" && request.method() === "POST") {
      createdTrips += 1;
      const input = request.postDataJSON();
      return response(route, { trip: { id: "trip-new", author_name: "卷主", markdown: input.markdown, ...input } }, 201);
    }
    if (path === "/api/trips/trip-1") return response(route, { trip: {
      id: "trip-1", title: "大同—太原", subtitle: "古建之旅", start_date: "2025-08-16", end_date: "2025-08-22",
      visibility: "private", status: "draft", markdown: "# 山西", author_name: "卷主", updated_at: now,
      places: [{ id: "cn-140100" }, { id: "cn-140200" }], tags: [{ id: "tag-1" }],
    } });
    if (path === "/api/trips/trip-1/versions") return response(route, { versions: [] });
    if (path === "/api/trips/trip-new/versions") return response(route, { versions: [] });
    if (path === "/api/trips/trip-1/media") return response(route, { media: [], can_edit: true });
    if (path === "/api/admin/overview") return response(route, { overview: {
      users: 1, pendingInvitations: 0, trips: 1, media: 0, pendingMedia: 0,
      storageBytes: 0, storageUpdatedAt: now, storageSoftLimitBytes: 8589934592,
    } });
    if (path === "/api/admin/users") return response(route, { users: [
      { id: "admin-1", email: "admin@example.com", nickname: "卷主", role: "admin", status: "active", trip_count: 1 },
    ] });
    if (path === "/api/admin/invitations" && request.method() === "GET") return response(route, { invitations: [] });
    if (path === "/api/admin/audit") return response(route, { logs: [] });
    if (path === "/api/admin/invitations" && request.method() === "POST") {
      invitationCreated = true;
      return response(route, { invitation: { id: "invite-1" } }, 201);
    }
    return response(route, { error: `unhandled:${request.method()}:${path}` }, 404);
  });

  await page.goto("http://127.0.0.1:4174/#admin", { waitUntil: "networkidle" });
  await page.waitForSelector("#admin-trip-list [data-edit-trip]", { state: "attached" });
  await page.click("#new-trip-button");
  await page.fill("#trip-form-name", "北京春日");
  await page.fill("#trip-form-markdown", "# 北京春日");
  await page.selectOption("#trip-form-places", ["cn-140100"]);
  await page.check('#trip-form-tags input[value="tag-1"]');
  await page.click('#trip-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector("#trip-form-id").value === "trip-new");

  await page.click('[data-admin-tab="people"]');
  await page.fill("#invitation-email", "friend@example.com");
  await page.selectOption("#invitation-role", "editor");
  await page.click('#invitation-form button[type="submit"]');
  await page.waitForTimeout(300);

  await page.click('[data-admin-tab="tags"]');
  await page.fill("#global-tag-name", "夜景");
  await page.fill("#global-tag-color", "#334455");
  await page.click('#global-tag-form button[type="submit"]');
  await page.waitForTimeout(100);

  const report = {
    signedIn: (await page.locator("#signed-in-user").textContent()).includes("admin@example.com"),
    placesLoaded: await page.locator("#trip-form-places option").count(),
    tagsLoaded: await page.locator("#trip-form-tags input").count(),
    createdTrips,
    invitationCreated,
    invitationStatus: await page.locator("#invitation-status").textContent(),
    tagCreated,
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
