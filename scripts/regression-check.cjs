const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

const amapStub = `
  (() => {
    class BaseLayer {
      hide() { this.visible = false; }
      show() { this.visible = true; }
    }
    class Map {
      add() {}
      remove() {}
      addControl() {}
      setZoomAndCenter() {}
      resize() {}
    }
    window.AMap = {
      Map,
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.route("**/config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.TRAVEL_ROLLS_CONFIG={amapKey:"test-public-key",amapServiceHost:"https://api.example.test",apiBase:""};',
    })
  );
  await page.route("https://webapi.amap.com/maps?**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: amapStub })
  );

  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });

  await page.click("#account-button");
  const loginViewVisible = await page.locator('[data-view="login"].active').count() === 1;
  const backendNotice = await page.locator("#auth-status").textContent();
  await page.fill("#login-email", "invited@example.com");
  await page.click('#request-code-form button[type="submit"]');
  const unavailableSubmitNotice = await page.locator("#auth-status").textContent();

  await page.click('[data-route="home"]');
  await page.click('[data-open-trip="shanxi"]');
  await page.click("#story-edit-toggle");
  const markdown = "# 自动化测试\n\n**粗体** 与 `代码`\n\n<script>window.__unsafe = true</script>";
  await page.fill("#story-markdown", markdown);
  await page.click("#story-preview");
  const markdownHeading = await page.locator("#story-rendered h1").textContent();
  const rawHtmlShownAsText = (await page.locator("#story-rendered").textContent()).includes("<script>");
  const scriptExecuted = await page.evaluate(() => window.__unsafe === true);
  await page.click("#story-save");
  const savedVersions = await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("travel-rolls.story-versions") || "{}");
    return value.shanxi?.length || 0;
  });

  await page.click('[data-route="map"]');
  await page.waitForFunction(() => document.querySelector("#map-status")?.dataset.kind === "ready");
  await page.selectOption("#province-select", "140000");
  const shanxiButton = {
    visible: await page.locator("#province-trip-button:visible").count() === 1,
    trip: await page.locator("#province-trip-button").getAttribute("data-open-trip"),
    label: await page.locator("#province-trip-button").textContent(),
  };
  await page.selectOption("#province-select", "130000");
  const hebeiButtonHidden = await page.locator("#province-trip-button[hidden]").count() === 1;
  const hebeiTripAttribute = await page.locator("#province-trip-button").getAttribute("data-open-trip");
  await page.click("#map-nationwide");
  const nationwideButtonHidden = await page.locator("#province-trip-button[hidden]").count() === 1;

  const report = {
    loginViewVisible,
    backendNotice,
    unavailableSubmitNotice,
    markdownHeading,
    rawHtmlShownAsText,
    scriptExecuted,
    savedVersions,
    shanxiButton,
    hebeiButtonHidden,
    hebeiTripAttribute,
    nationwideButtonHidden,
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
