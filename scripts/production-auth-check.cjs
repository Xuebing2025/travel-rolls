const { chromium } = require(
  "C:/Users/华为/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });
  await page.click("#account-button");
  await page.waitForFunction(() => {
    const status = document.querySelector("#auth-status");
    return status && !status.textContent.includes("正在检查");
  });

  const report = {
    loginViewVisible: await page.locator('[data-view="login"].active').count() === 1,
    authStatus: await page.locator("#auth-status").textContent(),
    accountLabel: await page.locator("#account-label").textContent(),
    apiBase: await page.evaluate(() => window.TRAVEL_ROLLS_CONFIG?.apiBase),
    errors,
  };
  process.stdout.write(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
