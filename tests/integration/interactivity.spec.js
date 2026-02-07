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

async function waitForData(page) {
  await page.goto(testServer.baseUrl);
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });
}

test.describe("Log panel toggle", () => {
  test("log container is initially hidden", async ({ page }) => {
    await waitForData(page);
    const logContainer = page.locator("#log-container");
    // aria-expanded starts as false → container hidden
    await expect(logContainer).toBeHidden();
  });

  test("clicking toggle opens the log panel", async ({ page }) => {
    await waitForData(page);
    const toggle = page.locator("#log-toggle");
    const logContainer = page.locator("#log-container");

    await expect(logContainer).toBeHidden();
    await toggle.click();
    await expect(logContainer).toBeVisible();
    // aria-expanded should now be true
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking toggle again closes the log panel", async ({ page }) => {
    await waitForData(page);
    const toggle = page.locator("#log-toggle");
    const logContainer = page.locator("#log-container");

    // Open
    await toggle.click();
    await expect(logContainer).toBeVisible();

    // Close
    await toggle.click();
    await expect(logContainer).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("log content shows log lines from fixture", async ({ page }) => {
    await waitForData(page);
    const toggle = page.locator("#log-toggle");
    const logContent = page.locator("#log-content");

    // Open the log panel to see content
    await toggle.click();
    await expect(logContent).toBeVisible();
    // Fixture live.log contains timestamped entries
    await expect(logContent).toContainText("Loop 1");
  });
});

test.describe("Stall detection", () => {
  test("stall section is hidden when no warnings", async ({ page }) => {
    await waitForData(page);
    const stallSection = page.locator("#stall-section");
    // With default fixture data (CB closed, no spikes), stall section
    // should have no visible warning content
    const stallContent = page.locator("#stall-content");
    const text = await stallContent.textContent();
    // No warnings with default fixture data (CB is CLOSED, no consecutive failures)
    expect(text.trim()).toBe("");
  });
});

test.describe("Header", () => {
  test("header is sticky at top", async ({ page }) => {
    await waitForData(page);
    const header = page.locator("header");
    const position = await header.evaluate(
      (el) => getComputedStyle(el).position
    );
    expect(position).toBe("sticky");
  });
});

test.describe("Responsive layout", () => {
  test("dashboard uses grid layout", async ({ page }) => {
    await waitForData(page);
    const main = page.locator("main");
    const display = await main.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("grid");
  });
});
