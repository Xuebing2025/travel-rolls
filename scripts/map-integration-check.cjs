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
        this.layers = [];
      }
      add(item) { this.layers.push(item); }
      remove(item) { this.layers = this.layers.filter((entry) => entry !== item); }
      addControl() {}
      setZoomAndCenter(zoom, center) { this.zoom = zoom; this.center = center; }
      resize() {}
    }
    class DistrictSearch {
      constructor(options) { this.options = options; }
      search(adcode, callback) {
        callback("complete", {
          districtList: [{
            name: adcode === "140000" ? "山西省" : "测试省",
            center: { lng: 112.5, lat: 37.8 },
            districtList: [
              { name: "太原市", adcode: "140100", center: { lng: 112.5489, lat: 37.8706 } },
              { name: "大同市", adcode: "140200", center: { lng: 113.3001, lat: 40.0768 } },
            ],
          }],
        });
      }
    }
    window.AMap = {
      Map,
      DistrictLayer: {
        Country: class extends BaseLayer {},
        Province: class extends BaseLayer {},
      },
      DistrictSearch,
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

  await page.route("**/config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.TRAVEL_ROLLS_CONFIG={amapKey:"test-public-key",amapServiceHost:"https://api.example.test"};',
    })
  );
  await page.route("https://webapi.amap.com/maps?**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: amapStub })
  );

  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });
  await page.click('[data-route="map"]');
  await page.waitForFunction(() => document.querySelector("#map-status")?.dataset.kind === "ready");
  const nationwideReady = await page.locator("#map-status").textContent();
  await page.selectOption("#province-select", "140000");
  await page.waitForFunction(() => document.querySelector("#province-name")?.textContent === "山西省");

  const report = {
    nationwideReady,
    liveMapVisible: await page.locator("#amap-container:not([hidden])").count() === 1,
    fallbackHidden: await page.locator("#map-fallback[hidden]").count() === 1,
    provinceName: await page.locator("#province-name").textContent(),
    cityCount: await page.locator("#city-list button").count(),
    visitedCityLinks: await page.locator('#city-list [data-open-trip="shanxi"]').count(),
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})();
