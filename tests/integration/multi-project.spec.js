// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("node:path");
const http = require("node:http");
const { DashboardServer } = require("../../src/server");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const FIXTURES_DIR_2 = path.join(__dirname, "..", "fixtures-project2");

let testServer;
let baseUrl;

// Project names derived from directory basenames
const proj1Name = path.basename(FIXTURES_DIR); // "fixtures"
const proj2Name = path.basename(FIXTURES_DIR_2); // "fixtures-project2"

test.beforeAll(async () => {
  testServer = new DashboardServer([FIXTURES_DIR, FIXTURES_DIR_2], { port: 0 });

  // Override hankDir for both projects (fixture dirs contain data files directly)
  for (const [, proj] of testServer.projects) {
    proj.hankDir = proj.projectPath;
  }

  await new Promise((resolve, reject) => {
    testServer.server = http.createServer((req, res) =>
      testServer.handleRequest(req, res)
    );
    testServer.server.listen(0, () => resolve());
    testServer.server.on("error", reject);
  });

  baseUrl = `http://localhost:${testServer.server.address().port}`;
});

test.afterAll(async () => {
  if (testServer) await testServer.stop();
});

test.describe("Project switcher UI", () => {
  test("project selector is visible with multiple projects", async ({
    page,
  }) => {
    await page.goto(baseUrl);
    const selector = page.locator("#project-selector");
    await expect(selector).toBeVisible({ timeout: 5000 });
  });

  test("project selector has both projects as options", async ({ page }) => {
    await page.goto(baseUrl);
    const selector = page.locator("#project-selector");
    await expect(selector).toBeVisible({ timeout: 5000 });

    const options = selector.locator("option");
    await expect(options).toHaveCount(2);

    const values = await options.allTextContents();
    expect(values).toContain(proj1Name);
    expect(values).toContain(proj2Name);
  });

  test("page title includes project name in multi-project mode", async ({
    page,
  }) => {
    await page.goto(baseUrl);
    // In multi-project mode, title should include project name
    await expect(page).toHaveTitle(new RegExp(proj1Name), { timeout: 5000 });
  });
});

test.describe("Project data isolation", () => {
  test("initial load shows first project data", async ({ page }) => {
    await page.goto(baseUrl);
    const badge = page.locator("#connection-status");
    await expect(badge).toHaveText("Connected", { timeout: 5000 });

    // Project 1 (fixtures) has 5 loops
    const statusBar = page.locator("#status-bar");
    await expect(statusBar).toContainText("5", { timeout: 5000 });
  });

  test("switching to second project updates dashboard", async ({ page }) => {
    await page.goto(baseUrl);
    const badge = page.locator("#connection-status");
    await expect(badge).toHaveText("Connected", { timeout: 5000 });

    // Wait for first project data to render
    const statusBar = page.locator("#status-bar");
    await expect(statusBar).toContainText("5", { timeout: 5000 });

    // Switch to project 2
    const selector = page.locator("#project-selector");
    await selector.selectOption(proj2Name);

    // Wait for reconnect and new data — project 2 has 8 loops in status.json
    await expect(badge).toHaveText("Connected", { timeout: 5000 });
    await expect(statusBar).toContainText("8", { timeout: 5000 });
  });

  test("switching projects updates circuit breaker state", async ({ page }) => {
    await page.goto(baseUrl);
    const badge = page.locator("#connection-status");
    await expect(badge).toHaveText("Connected", { timeout: 5000 });

    // Project 1: circuit breaker is CLOSED
    const cbState = page.locator("#cb-state");
    await expect(cbState).toHaveText("CLOSED", { timeout: 5000 });

    // Switch to project 2: circuit breaker is OPEN
    const selector = page.locator("#project-selector");
    await selector.selectOption(proj2Name);
    await expect(badge).toHaveText("Connected", { timeout: 5000 });
    await expect(cbState).toHaveText("OPEN", { timeout: 5000 });
  });

  test("switching projects updates page title", async ({ page }) => {
    await page.goto(baseUrl);
    await expect(page).toHaveTitle(new RegExp(proj1Name), { timeout: 5000 });

    // Switch to project 2
    const selector = page.locator("#project-selector");
    await selector.selectOption(proj2Name);
    await expect(page).toHaveTitle(new RegExp(proj2Name), { timeout: 5000 });
  });

  test("switching back to first project restores its data", async ({
    page,
  }) => {
    await page.goto(baseUrl);
    const badge = page.locator("#connection-status");
    await expect(badge).toHaveText("Connected", { timeout: 5000 });

    const statusBar = page.locator("#status-bar");
    await expect(statusBar).toContainText("5", { timeout: 5000 });

    // Switch to project 2
    const selector = page.locator("#project-selector");
    await selector.selectOption(proj2Name);
    await expect(badge).toHaveText("Connected", { timeout: 5000 });
    await expect(statusBar).toContainText("8", { timeout: 5000 });

    // Switch back to project 1
    await selector.selectOption(proj1Name);
    await expect(badge).toHaveText("Connected", { timeout: 5000 });
    await expect(statusBar).toContainText("5", { timeout: 5000 });
  });
});

test.describe("Multi-project API", () => {
  test("/api/projects returns both projects", async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/projects`);
    expect(response.ok()).toBe(true);

    const projects = await response.json();
    expect(projects).toHaveLength(2);

    const names = projects.map((p) => p.name);
    expect(names).toContain(proj1Name);
    expect(names).toContain(proj2Name);
  });

  test("/api/data per project returns different data", async ({ page }) => {
    const res1 = await page.request.get(
      `${baseUrl}/api/data?project=${proj1Name}`
    );
    const res2 = await page.request.get(
      `${baseUrl}/api/data?project=${proj2Name}`
    );

    const data1 = await res1.json();
    const data2 = await res2.json();

    // Different loop counts
    expect(data1.costLog.length).toBe(5);
    expect(data2.costLog.length).toBe(3);

    // Different circuit breaker states
    expect(data1.circuitBreaker.state).toBe("CLOSED");
    expect(data2.circuitBreaker.state).toBe("OPEN");
  });
});
