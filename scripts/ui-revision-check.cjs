const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/\/config\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: "window.TRAVEL_ROLLS_CONFIG={};" })
  );
  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });
  const initialHomeLegacyTrips = await page.locator('.home-grid [data-open-trip]').count();
  const initialLoadingRolls = await page.locator(".home-grid .loading-roll").count();
  await page.evaluate(() => {
    authUser = { id: "admin-local", role: "admin", nickname: "管理员" };
    activeTripId = "shanxi";
    serverTripDetails.set("shanxi", { id: "shanxi", can_edit: true });
    route("trip", false);
    renderPublicGallery([
      {
        id: "media-a",
        kind: "image",
        content_url: "/assets/travel/datong.webp",
        original_filename: "datong.webp",
        description: "大同古建",
        place_name: "大同",
        captured_at: "2025-08-18T08:00:00.000Z",
        like_count: 2,
        liked: false,
        favorited: false,
      },
      ...["taiyuan", "hangzhou", "dalian"].map((name, index) => ({
        id: `media-${index}`,
        kind: "image",
        content_url: `/assets/travel/${name}.webp`,
        original_filename: `${name}.webp`,
        description: name,
        place_name: name,
        captured_at: "2025-08-19T08:00:00.000Z",
        like_count: 0,
        liked: false,
        favorited: false,
      })),
    ]);
  });

  const gridColumns = await page.locator("#trip-gallery").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").length
  );
  await page.screenshot({ path: "D:/CodexProject/ui-revision-trip.png", fullPage: true });
  await page.locator('[data-preview-media="media-a"]').click();
  const previewOpen = await page.locator("#media-preview-dialog[open]").count() === 1;
  await page.click("#media-preview-close");
  await page.locator('[data-media-more="media-a"]').click();
  const moreActions = await page.locator("#media-action-menu").innerText();
  await page.keyboard.press("Escape");
  await page.locator('[data-public-media="media-a"]').click({ button: "right" });
  const contextActions = await page.locator("#media-action-menu").innerText();
  await page.click('[data-gallery-layout="masonry"]');
  const masonryActionsHidden = await page.locator(
    '#trip-gallery.masonry [data-public-media="media-a"] figcaption'
  ).evaluate((element) => getComputedStyle(element).display === "none");
  await page.evaluate(() => {
    apiRequest = async (path, options = {}) => {
      if (path === "/api/places" && options.method === "POST") {
        const city = JSON.parse(options.body);
        return {
          place: {
            id: `cn-${city.cityCode}`,
            country_code: "CN",
            province_code: city.provinceCode,
            city_code: city.cityCode,
            official_name: city.officialName,
            display_name: city.displayName,
            level: "city",
            center_lat: city.centerLat,
            center_lng: city.centerLng,
          },
        };
      }
      return {};
    };
    adminState.places = [];
    route("admin", false);
    setAdminTab("trips");
    renderPlaceOptions();
  });
  await page.selectOption("#trip-form-province", "140000");
  await page.waitForFunction(() => document.querySelector("#trip-form-city").options.length > 1);
  const cityOptionCount = await page.locator("#trip-form-city option").count();
  await page.selectOption("#trip-form-city", "140100");
  await page.click("#trip-form-add-place");
  await page.waitForFunction(() => document.querySelector("#trip-form-selected-places").textContent.includes("太原"));
  const selectedCity = await page.locator("#trip-form-selected-places").innerText();

  const report = {
    toolbar: await page.locator(".gallery-toolbar").innerText(),
    gridColumns,
    previewOpen,
    moreActions,
    contextActions,
    masonryActionsHidden,
    adminTabs: await page.locator(".admin-tabs").allTextContents(),
    provincePickerPresent: await page.locator("#trip-form-province").count() === 1,
    cityOptionCount,
    selectedCity,
    initialHomeLegacyTrips,
    initialLoadingRolls,
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})();
