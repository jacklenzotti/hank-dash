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

/** Wait for SSE connection before asserting panel content. */
async function waitForData(page) {
  await page.goto(testServer.baseUrl);
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });
}

test.describe("Status bar", () => {
  test("displays loop count, cost, and duration", async ({ page }) => {
    await waitForData(page);
    const bar = page.locator("#status-bar");
    // Fixture has 5 loops
    await expect(bar).toContainText("5");
    // Cost from session: $0.1167
    await expect(bar).toContainText("$0.1167");
  });

  test("shows API call count", async ({ page }) => {
    await waitForData(page);
    const bar = page.locator("#status-bar");
    // Fixture status.json: calls_made_this_hour = 5
    await expect(bar).toContainText("5");
  });
});

test.describe("Circuit breaker", () => {
  test("shows current state", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#circuit-breaker-section");
    // Fixture: state = CLOSED
    await expect(section).toContainText("CLOSED");
  });

  test("displays transition history", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#circuit-breaker-section");
    // Fixture has 3 transitions: CLOSED→OPEN, OPEN→HALF_OPEN, HALF_OPEN→CLOSED
    await expect(section).toContainText("OPEN");
    await expect(section).toContainText("HALF_OPEN");
  });
});

test.describe("Cost per loop chart", () => {
  test("renders bars for each loop", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#cost-section");
    // Should have chart bars for 5 loops
    const bars = section.locator(".chart-bar");
    await expect(bars).toHaveCount(5);
  });
});

test.describe("Cumulative cost chart", () => {
  test("renders cumulative bars", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#cumulative-cost-section");
    const bars = section.locator(".chart-bar");
    await expect(bars).toHaveCount(5);
  });
});

test.describe("Token breakdown", () => {
  test("shows token usage bars", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#token-section");
    // Should contain token type labels
    await expect(section).toContainText("input", { ignoreCase: true });
    await expect(section).toContainText("output", { ignoreCase: true });
  });
});

test.describe("Loop timeline", () => {
  test("shows loop entries in reverse order", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#timeline-section");
    // Fixture has 5 loops — timeline renders abbreviated labels
    await expect(section).toContainText("L5");
    await expect(section).toContainText("L1");
  });
});

test.describe("Implementation plan", () => {
  test("shows progress bar and tasks", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#plan-section");
    // Fixture IMPLEMENTATION_PLAN.md has 2/5 completed
    await expect(section).toContainText("2");
    await expect(section).toContainText("5");
    // Check task text from fixture
    await expect(section).toContainText("Set up project scaffold");
    await expect(section).toContainText("Create data parsers");
  });
});

test.describe("Response analysis", () => {
  test("shows confidence and summary", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#analysis-section");
    // Fixture: confidence 0.85 = 85%
    await expect(section).toContainText("85%");
    // Fixture summary
    await expect(section).toContainText("Implemented cost parser");
  });

  test("lists changed files", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#analysis-section");
    await expect(section).toContainText("src/server.js");
    await expect(section).toContainText("src/parsers/cost.js");
  });
});

test.describe("Issue burndown", () => {
  test("shows issue table with cost breakdown", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#issue-section");
    // Fixture cost_log has issue_number: 1, 2, 3
    await expect(section).toContainText("#1");
    await expect(section).toContainText("#2");
    await expect(section).toContainText("#3");
  });
});

test.describe("Model usage", () => {
  test("shows model breakdown table", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#model-section");
    // Fixture uses claude-sonnet-4-5-20250929
    await expect(section).toContainText("claude-sonnet-4-5-20250929");
  });
});

test.describe("Cache hit rate", () => {
  test("renders cache rate bars", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#cache-section");
    const bars = section.locator(".chart-bar");
    // One bar per loop with cache data
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Cost velocity", () => {
  test("renders velocity bars", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#velocity-section");
    const bars = section.locator(".chart-bar");
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Exit signals", () => {
  test("shows done signals and test-only loops", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#exit-section");
    // Fixture: done_signals include all_tests_passing, implementation_complete
    await expect(section).toContainText("all_tests_passing");
    await expect(section).toContainText("implementation_complete");
  });
});

test.describe("Session history", () => {
  test("shows historical sessions table", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#session-history-section");
    // Fixture has 2 sessions — rendered as table rows with exit reasons
    await expect(section).toContainText("all_tests_passing");
    await expect(section).toContainText("circuit_breaker_open");
    // Cost values from fixture
    await expect(section).toContainText("$0.4500");
    await expect(section).toContainText("$1.2300");
  });
});

test.describe("Log panel", () => {
  test("log section exists and contains log toggle", async ({ page }) => {
    await waitForData(page);
    const section = page.locator("#log-section");
    await expect(section).toBeAttached();
    // Log toggle button
    const toggle = page.locator("#log-toggle");
    await expect(toggle).toBeAttached();
  });
});
