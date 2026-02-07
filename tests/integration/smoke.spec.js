// @ts-check
const { test, expect } = require("@playwright/test");
const { startTestServer } = require("./setup");

let testServer;

test.beforeAll(async () => {
  testServer = await startTestServer();
});

test.afterAll(async () => {
  if (testServer) await testServer.server.stop();
});

test("page loads with correct title", async ({ page }) => {
  await page.goto(testServer.baseUrl);
  await expect(page).toHaveTitle("Hank Dashboard");
});

test("main container renders", async ({ page }) => {
  await page.goto(testServer.baseUrl);
  const main = page.locator("main");
  await expect(main).toBeVisible();
});

test("header displays with connection status", async ({ page }) => {
  await page.goto(testServer.baseUrl);
  const header = page.locator("header");
  await expect(header).toBeVisible();
  await expect(header).toContainText("Hank Dashboard");

  // Connection status badge should appear
  const badge = page.locator("#connection-status");
  await expect(badge).toBeVisible();
});

test("SSE connects and shows Connected badge", async ({ page }) => {
  await page.goto(testServer.baseUrl);

  // Wait for SSE to connect and badge to update
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });
  await expect(badge).toHaveClass(/connected/);
});

test("all dashboard sections are present", async ({ page }) => {
  await page.goto(testServer.baseUrl);

  const sections = [
    "status-bar",
    "circuit-breaker-section",
    "stall-section",
    "cost-section",
    "cumulative-cost-section",
    "token-section",
    "timeline-section",
    "plan-section",
    "analysis-section",
    "issue-section",
    "model-section",
    "cache-section",
    "velocity-section",
    "session-history-section",
    "log-section",
    "exit-section",
  ];

  for (const id of sections) {
    const section = page.locator(`#${id}`);
    await expect(section).toBeAttached({ timeout: 5000 });
  }
});

test("dashboard populates with data from fixtures", async ({ page }) => {
  await page.goto(testServer.baseUrl);

  // Wait for SSE data to render
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });

  // Status bar should show loop count from fixtures (5 loops)
  const statusBar = page.locator("#status-bar");
  await expect(statusBar).toContainText("5", { timeout: 5000 });
});
