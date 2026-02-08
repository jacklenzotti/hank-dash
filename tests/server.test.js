const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const { DashboardServer } = require("../src/server");

const FIXTURES_DIR = path.join(__dirname, "fixtures");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        );
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

describe("DashboardServer", () => {
  let server;

  after(async () => {
    if (server) await server.stop();
  });

  it("starts and serves API data", async () => {
    // FIXTURES_DIR mimics a .hank directory (has cost_log.jsonl, status.json, etc.)
    // We need to point server at the parent of .hank, so we use a trick:
    // The server looks for projectPath/.hank/, but our fixtures ARE the hank dir.
    // So we'll set projectPath to fixtures/.. and override hankDir.
    server = new DashboardServer(FIXTURES_DIR, { port: 0 });
    // Override hankDir to point directly at fixtures
    server.hankDir = FIXTURES_DIR;

    await new Promise((resolve, reject) => {
      server.server = http.createServer((req, res) =>
        server.handleRequest(req, res)
      );
      server.server.listen(0, () => resolve());
      server.server.on("error", reject);
    });

    const port = server.server.address().port;
    const res = await httpGet(`http://localhost:${port}/api/data`);

    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);

    // Verify parsers were called and returned data
    assert.ok(Array.isArray(data.costLog));
    assert.equal(data.costLog.length, 5);
    assert.ok(data.status);
    assert.equal(data.status.loopCount, 5);
  });

  it("serves static files", async () => {
    const port = server.server.address().port;
    const res = await httpGet(`http://localhost:${port}/`);
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"].includes("text/html"));
    assert.ok(res.body.includes("Hank Dashboard"));
  });

  it("returns 404 for unknown paths", async () => {
    const port = server.server.address().port;
    const res = await httpGet(`http://localhost:${port}/nonexistent`);
    assert.equal(res.status, 404);
  });

  it("smoke test: HTML contains all dashboard sections", async () => {
    const port = server.server.address().port;
    const res = await httpGet(`http://localhost:${port}/`);
    assert.equal(res.status, 200);

    // Every dashboard section should be present in the served HTML
    const requiredIds = [
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
      "error-catalog-section",
      "retry-activity-section",
    ];
    for (const id of requiredIds) {
      assert.ok(res.body.includes(`id="${id}"`), `HTML missing section: ${id}`);
    }

    // Verify key interactive elements
    assert.ok(res.body.includes('id="connection-status"'));
    assert.ok(res.body.includes('<script src="app.js"></script>'));
    assert.ok(res.body.includes('<link rel="stylesheet" href="style.css"'));
  });

  it("smoke test: API data contains all parser sections", async () => {
    const port = server.server.address().port;
    const res = await httpGet(`http://localhost:${port}/api/data`);
    const data = JSON.parse(res.body);

    // Verify all parser keys are present
    const requiredKeys = [
      "costLog",
      "costSession",
      "circuitBreaker",
      "circuitBreakerHistory",
      "responseAnalysis",
      "exitSignals",
      "status",
      "progress",
      "implementationPlan",
      "liveLog",
      "sessionHistory",
      "errorCatalog",
      "retryLog",
    ];
    for (const key of requiredKeys) {
      assert.ok(key in data, `API response missing key: ${key}`);
    }

    // Verify data types
    assert.ok(Array.isArray(data.costLog));
    assert.ok(Array.isArray(data.circuitBreakerHistory));
    assert.equal(typeof data.costSession, "object");
    assert.equal(typeof data.circuitBreaker, "object");
    assert.equal(typeof data.implementationPlan, "object");
    assert.ok(data.implementationPlan.totalCount > 0);
  });

  it("serves SSE endpoint", async () => {
    const port = server.server.address().port;

    const data = await new Promise((resolve, reject) => {
      http
        .get(`http://localhost:${port}/api/events`, (res) => {
          assert.equal(res.headers["content-type"], "text/event-stream");
          let buf = "";
          res.on("data", (chunk) => {
            buf += chunk;
            // SSE sends "data: {...}\n\n" — once we get the double newline, parse
            if (buf.includes("\n\n")) {
              res.destroy();
              const jsonStr = buf.replace("data: ", "").trim();
              resolve(JSON.parse(jsonStr));
            }
          });
          res.on("error", (err) => {
            // ECONNRESET is expected when we destroy
            if (err.code !== "ECONNRESET") reject(err);
          });
        })
        .on("error", reject);
    });

    assert.ok(data.costLog);
    assert.equal(data.costLog.length, 5);
  });
});
