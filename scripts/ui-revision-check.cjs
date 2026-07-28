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
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  await page.route(/\/config\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: "window.TRAVEL_ROLLS_CONFIG={};" })
  );
  await page.goto("http://127.0.0.1:4174", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const typography = await page.evaluate(() => ({
    wenkaiLoaded: document.fonts.check('16px "LXGW WenKai GB Web"'),
    body: getComputedStyle(document.body).fontFamily,
    wordmark: getComputedStyle(document.querySelector(".wordmark strong")).fontFamily,
    homeTitle: getComputedStyle(document.querySelector(".home-copy h1")).fontFamily,
  }));
  const initialHomeLegacyTrips = await page.locator('.home-grid [data-open-trip]').count();
  const initialLoadingRolls = await page.locator(".home-grid .loading-roll").count();
  const introBridge = await page.evaluate(() => {
    let cleaned = false;
    const mounted = TravelRollsIntro.mount((root) => {
      root.textContent = "FRAMER READY";
      return () => { cleaned = true; };
    }, { respectReducedMotion: false });
    const visibleWhileMounted = !TravelRollsIntro.root.hidden && document.body.classList.contains("intro-motion-active");
    TravelRollsIntro.complete("test");
    return { mounted, visibleWhileMounted, cleaned, hiddenAfterComplete: TravelRollsIntro.root.hidden };
  });
  await page.evaluate(() => {
    renderHomeStats(
      [{ id: "trip-1" }, { id: "trip-2" }, { id: "trip-3" }],
      { trips: 3, cities: 2, images: 121 }
    );
  });
  const homeStats = await page.locator(".stats dd").allTextContents();
  const homeFrames = await page.locator("#home-frame-count").textContent();
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
  const gridCaptionsHidden = await page.locator("#trip-gallery figcaption").count() === 0;
  const gridUsesFourThreeCrop = await page.locator('[data-preview-media="media-a"]').evaluate((element) => {
    const style = getComputedStyle(element);
    const ratio = element.getBoundingClientRect().width / element.getBoundingClientRect().height;
    return Math.abs(ratio - 4 / 3) < 0.02 && style.objectFit === "cover" && style.objectPosition === "50% 50%";
  });
  await page.click("#tag-editor-toggle");
  await page.click("#trip-date");
  const tagEditorClosedOutside = await page.locator("#tag-editor").evaluate((element) => element.hidden);
  await page.screenshot({ path: "D:/CodexProject/ui-revision-trip.png", fullPage: true });
  await page.locator('[data-preview-media="media-a"]').click();
  const previewOpen = await page.locator("#media-preview-dialog[open]").count() === 1;
  const previewActionLabels = await page.locator("#media-preview-actions button").evaluateAll(
    (buttons) => buttons.map((button) => button.getAttribute("aria-label"))
  );
  await page.click('[data-preview-media-more="media-a"]');
  const moreActions = await page.locator("#media-preview-more-menu").innerText();
  await page.click("#media-preview-close");
  await page.locator('[data-public-media="media-a"]').click({ button: "right" });
  const contextActions = await page.locator("#media-action-menu").innerText();
  await page.click('[data-gallery-layout="masonry"]');
  const masonryActionsHidden = await page.locator("#trip-gallery.masonry figcaption").count() === 0;
  await page.evaluate(() => {
    window.__mockPlaces = new Map();
    apiRequest = async (path, options = {}) => {
      if (path === "/api/places" && options.method === "POST") {
        const city = JSON.parse(options.body);
        const isChina = city.countryCode === "CN";
        const place = {
            id: isChina ? `cn-${city.cityCode}` : `geo-${city.countryCode.toLowerCase()}-${city.geoNameId}`,
            country_code: city.countryCode,
            province_code: city.provinceCode,
            city_code: city.cityCode,
            official_name: city.officialName,
            display_name: city.displayName,
            level: "city",
            center_lat: city.centerLat,
            center_lng: city.centerLng,
        };
        window.__mockPlaces.set(place.id, place);
        return { place };
      }
      if (path === "/api/trips/shanxi" && options.method === "PATCH") {
        const payload = JSON.parse(options.body);
        return {
          trip: {
            id: "shanxi",
            can_edit: true,
            places: (payload.placeIds || []).map((id) => window.__mockPlaces.get(id)).filter(Boolean),
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
  await page.waitForFunction(() => document.querySelectorAll("#trip-form-country optgroup").length > 0);
  const countryGroups = await page.locator("#trip-form-country optgroup").allTextContents();
  const defaultCountry = await page.locator("#trip-form-country").inputValue();
  await page.selectOption("#trip-form-province", "140000");
  await page.waitForFunction(() => document.querySelector("#trip-form-city").options.length > 1);
  const cityOptionCount = await page.locator("#trip-form-city option").count();
  await page.selectOption("#trip-form-city", "CN:140100");
  await page.click("#trip-form-add-place");
  await page.waitForFunction(() => document.querySelector("#trip-form-selected-places").textContent.includes("太原"));
  await page.selectOption("#trip-form-country", "US");
  await page.waitForFunction(() => document.querySelector("#trip-form-city").options.length > 100);
  const internationalCityCount = await page.locator("#trip-form-city option").count();
  const newYorkValue = await page.locator("#trip-form-city").evaluate((select) =>
    [...select.options].find((option) => option.textContent.includes("New York City"))?.value || ""
  );
  await page.selectOption("#trip-form-city", newYorkValue);
  await page.click("#trip-form-add-place");
  await page.waitForFunction(() => document.querySelector("#trip-form-selected-places").textContent.includes("New York"));
  const selectedCities = await page.locator("#trip-form-selected-places").innerText();
  const englishCountriesSorted = await page.evaluate(() => {
    document.documentElement.lang = "en";
    document.dispatchEvent(new CustomEvent("travelrolls:language-change"));
    const names = [...document.querySelectorAll("#trip-form-country optgroup:first-of-type option")]
      .map((option) => option.textContent);
    const expected = [...names].sort((left, right) => new Intl.Collator("en").compare(left, right));
    const sorted = names.every((name, index) => name === expected[index]);
    document.documentElement.lang = "zh-CN";
    document.dispatchEvent(new CustomEvent("travelrolls:language-change"));
    return sorted;
  });
  await page.fill('input[aria-label="搜索国家"]', "日本");
  const countrySearchResults = await page.locator("#trip-form-country option").allTextContents();
  await page.fill('input[aria-label="搜索国家"]', "");
  await page.evaluate(() => {
    authUser = { id: "admin-local", role: "admin", nickname: "管理员" };
    activeTripId = "shanxi";
    serverTripDetails.set("shanxi", { id: "shanxi", can_edit: true, places: [] });
    route("trip", false);
    renderTripCoordinates([]);
    renderPublicGallery([]);
  });
  await page.click("#trip-add-place-tile");
  await page.selectOption("#quick-place-province", "140000");
  await page.waitForFunction(() => document.querySelector("#quick-place-city").options.length > 1);
  await page.selectOption("#quick-place-city", "CN:140100");
  await page.click('#quick-place-form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector("#quick-place-dialog").open);
  const quickAddedCity = await page.locator(".trip-body > aside dl").innerText();
  await page.click(".gallery-add-tile");
  const quickUploadDialogOpen = await page.locator("#quick-upload-dialog[open]").count() === 1;
  const quickUploadPlaceOptions = await page.locator("#quick-upload-place option").allTextContents();
  await page.click('[data-close-dialog="quick-upload-dialog"]');
  await page.evaluate(() => {
    adminState.trips = [
      { id: "b", title: "北京", status: "published", visibility: "public", media_count: 2, updated_at: 1767398400000 },
      { id: "a", title: "大同", status: "draft", visibility: "private", media_count: 9, updated_at: 1783036800000 },
      { id: "c", title: "阿勒泰", status: "published", visibility: "link", media_count: 5, updated_at: 1735862400000 },
    ];
    route("admin", false);
    setAdminTab("trips");
    renderManagedTrips();
  });
  await page.click('[data-trip-sort="title"]');
  const titleSortOrder = await page.locator("#admin-trip-list .table-row span:first-child").allTextContents();
  await page.click('[data-trip-sort="updated_at"]');
  const updatedSortOrder = await page.locator("#admin-trip-list .table-row span:first-child").allTextContents();
  const adminTripHeaderSize = await page.locator("#admin-trip-list > .table-head").evaluate(
    (element) => getComputedStyle(element).fontSize
  );

  const report = {
    toolbar: await page.locator(".gallery-toolbar").innerText(),
    gridColumns,
    gridCaptionsHidden,
    gridUsesFourThreeCrop,
    previewOpen,
    previewActionLabels,
    moreActions,
    contextActions,
    masonryActionsHidden,
    tagEditorClosedOutside,
    introBridge,
    adminTabs: await page.locator(".admin-tabs").allTextContents(),
    countryGroups,
    defaultCountry,
    provincePickerPresent: await page.locator("#trip-form-province").count() === 1,
    cityOptionCount,
    internationalCityCount,
    selectedCities,
    englishCountriesSorted,
    countrySearchResults,
    quickAddedCity,
    quickUploadDialogOpen,
    quickUploadPlaceOptions,
    titleSortOrder,
    updatedSortOrder,
    adminTripHeaderSize,
    initialHomeLegacyTrips,
    initialLoadingRolls,
    homeStats,
    homeFrames,
    typography,
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})();
