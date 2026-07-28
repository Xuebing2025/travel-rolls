const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

const amapStub = `
  (() => {
    class BaseLayer {
      constructor(options) { this.options = options; this.visible = true; }
      hide() { this.visible = false; }
      show() { this.visible = true; }
    }
    class Map {
      constructor(container, options) {
        this.container = container;
        this.options = options;
        this.zoom = options.zoom;
        this.center = options.center;
        this.layers = [];
        window.__travelRollsTestMap = this;
      }
      add(item) {
        this.layers.push(item);
        if (item.content) this.container.append(item.content);
      }
      remove(item) {
        this.layers = this.layers.filter((entry) => entry !== item);
        item.content?.remove();
      }
      addControl() {}
      setZoomAndCenter(zoom, center) { this.zoom = zoom; this.center = center; }
      resize() {}
    }
    class Marker extends BaseLayer {
      constructor(options) {
        super(options);
        this.position = options.position;
        this.content = options.content;
      }
    }
    window.AMap = {
      Map,
      Marker,
      DistrictLayer: {
        Country: class extends BaseLayer {},
        Province: class extends BaseLayer {},
      },
      Scale: class {},
      ToolBar: class {},
    };
  })();
`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.route(/\/config\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.TRAVEL_ROLLS_CONFIG={amapKey:"test-public-key",amapServiceHost:"https://api.example.test",apiBase:"https://api.example.test"};',
    })
  );
  await page.route("https://api.example.test/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const bodies = {
      "/api/map": {
        cities: [
          { city_code: "140100", province_code: "140000", display_name: "太原", center_lng: 112.5489, center_lat: 37.8706, visit_count: 2, media_count: 18, trip_id: "shanxi" },
        ],
        globalCities: [
          { country_code: "FR", city_code: "2988507", display_name: "巴黎", center_lng: 2.3522, center_lat: 48.8566, visit_count: 3, media_count: 24, trip_id: "paris" },
        ],
      },
      "/api/trips": { trips: [] },
      "/api/settings": { settings: {} },
      "/api/stats": { trips: 0, cities: 0, images: 0 },
      "/api/me": { user: null },
    };
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(bodies[path] || {}),
    });
  });
  await page.route(/^https:\/\/webapi\.amap\.com\/maps\?/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: amapStub })
  );

  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });
  await page.click('[data-route="map"]');
  await page.waitForFunction(() => document.querySelector("#map-status")?.dataset.kind === "ready");
  await page.waitForFunction(() => document.querySelector("#map-loading-poster")?.hidden === true);
  await page.waitForFunction(() => document.querySelector("#map-status")?.textContent === "");
  const loadingStatusFaded = await page.locator("#map-status").evaluate(
    (element) => element.classList.contains("complete") && getComputedStyle(element).opacity === "0"
  );
  const nationwideView = await page.evaluate(() => ({
    center: window.__travelRollsTestMap.center,
    zoom: window.__travelRollsTestMap.zoom,
  }));
  await page.selectOption("#province-select", "140000");
  await page.waitForFunction(() => document.querySelector("#province-name")?.textContent === "山西省");
  const selectedProvince = await page.locator("#province-name").textContent();
  const selectedProvinceCityCount = await page.locator("#city-list button").count();
  const selectedProvinceTripLinks = await page.locator('#city-list [data-open-trip="shanxi"]').count();
  await page.click("#map-global");
  const globalView = await page.evaluate(() => ({
    center: window.__travelRollsTestMap.center,
    zoom: window.__travelRollsTestMap.zoom,
  }));
  const globalCity = await page.locator("#city-list").innerText();
  const globalMarkerCount = await page.locator(".global-visit-marker").count();
  await page.click(".map-reset-control");
  const resetView = await page.evaluate(() => ({
    center: window.__travelRollsTestMap.center,
    zoom: window.__travelRollsTestMap.zoom,
  }));

  const report = {
    loadingStatusFaded,
    nationwideView,
    liveMapVisible: await page.locator("#amap-container:not([hidden])").count() === 1,
    fallbackHidden: await page.locator("#map-fallback[hidden]").count() === 1,
    loadingPosterHidden: await page.locator("#map-loading-poster[hidden]").count() === 1,
    selectedProvince,
    selectedProvinceCityCount,
    selectedProvinceTripLinks,
    globalView,
    globalCity,
    globalMarkerCount,
    resetView,
    provinceSearchPresent: await page.locator('input[aria-label="搜索地区"]').count() === 1,
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})();
