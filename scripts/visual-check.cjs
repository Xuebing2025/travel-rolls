const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "artifacts/home.png", fullPage: true });
  await page.click('[data-route="map"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/map.png", fullPage: true });
  await page.locator('.view.active [data-open-trip="shanxi"]').last().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/trip.png", fullPage: true });

  const report = {
    title: await page.title(),
    routes: await page.locator("[data-view]").count(),
    images: await page.locator("img").count(),
    brokenImages: await page.locator("img").evaluateAll((images) =>
      images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src)
    ),
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})();
