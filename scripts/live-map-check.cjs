const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

function redact(value) {
  return String(value)
    .replace(/([?&](?:key|jscode)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\b[a-f0-9]{32}\b/gi, "[REDACTED]");
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(redact(message.text()));
  });
  page.on("pageerror", (error) => errors.push(redact(error.message)));

  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });
  await page.click('[data-route="map"]');
  await page.waitForTimeout(12000);
  const status = await page.locator("#map-status").textContent();
  const kind = await page.locator("#map-status").getAttribute("data-kind");
  if (kind === "ready") {
    await page.selectOption("#province-select", "140000");
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: "artifacts/map-live.png", fullPage: true });
  const report = {
    status,
    kind,
    liveMapVisible: await page.locator("#amap-container:not([hidden])").count() === 1,
    fallbackVisible: await page.locator("#map-fallback:not([hidden])").count() === 1,
    provinceName: await page.locator("#province-name").textContent(),
    cityCount: await page.locator("#city-list button").count(),
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})();
