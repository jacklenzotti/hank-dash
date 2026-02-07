// @ts-check
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { DashboardServer } = require("../../src/server");

let testServer;
let tmpDir;
let hankDir;

/**
 * Create a temp project directory with .hank/ and copy fixture files into it.
 * This lets us modify data files and test live SSE updates without touching
 * shared fixtures.
 */
function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hank-dash-test-"));
  const hank = path.join(dir, ".hank");
  fs.mkdirSync(hank);

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const files = fs.readdirSync(fixturesDir);
  for (const file of files) {
    const src = path.join(fixturesDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(hank, file));
    }
  }

  return { dir, hank };
}

test.beforeAll(async () => {
  const tmp = createTempProject();
  tmpDir = tmp.dir;
  hankDir = tmp.hank;

  testServer = new DashboardServer(tmpDir, { port: 0 });
  await testServer.start();
});

test.afterAll(async () => {
  if (testServer) await testServer.stop();
  // Clean up temp directory
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getBaseUrl() {
  return `http://localhost:${testServer.server.address().port}`;
}

test("SSE connects and shows Connected badge", async ({ page }) => {
  await page.goto(getBaseUrl());
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });
  await expect(badge).toHaveClass(/connected/);
});

test("connection status shows Disconnected after server stops SSE", async ({
  page,
}) => {
  await page.goto(getBaseUrl());
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });

  // Kill all SSE clients to simulate disconnect
  for (const proj of testServer.projects.values()) {
    for (const client of proj.sseClients) {
      client.end();
    }
    proj.sseClients.clear();
  }

  await expect(badge).toHaveText("Disconnected", { timeout: 5000 });
});

test("live data updates when fixture files change", async ({ page }) => {
  await page.goto(getBaseUrl());
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });

  // Wait for initial render with 5 loops
  const statusBar = page.locator("#status-bar");
  await expect(statusBar).toContainText("5", { timeout: 5000 });

  // Update status.json to show 10 loops
  const statusPath = path.join(hankDir, "status.json");
  const statusData = JSON.parse(fs.readFileSync(statusPath, "utf8"));
  statusData.loop_count = 10;
  fs.writeFileSync(statusPath, JSON.stringify(statusData));

  // File watcher debounces 300ms, then SSE pushes update
  await expect(statusBar).toContainText("10", { timeout: 5000 });
});

test("SSE reconnects after disconnect", async ({ page }) => {
  await page.goto(getBaseUrl());
  const badge = page.locator("#connection-status");
  await expect(badge).toHaveText("Connected", { timeout: 5000 });

  // End SSE connections to trigger reconnect
  for (const proj of testServer.projects.values()) {
    for (const client of proj.sseClients) {
      client.end();
    }
    proj.sseClients.clear();
  }

  await expect(badge).toHaveText("Disconnected", { timeout: 5000 });

  // Frontend reconnects after 3 seconds — wait for it
  await expect(badge).toHaveText("Connected", { timeout: 8000 });
});
