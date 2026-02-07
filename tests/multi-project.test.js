const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const { DashboardServer } = require("../src/server");

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const FIXTURES_DIR_2 = path.join(__dirname, "fixtures-project2");

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

/**
 * Start a multi-project server with two fixture directories.
 * Each project's hankDir is overridden to point directly at its fixtures
 * (since fixtures ARE the hank dir, not a parent with .hank/ inside).
 */
async function startMultiProjectServer() {
  const server = new DashboardServer([FIXTURES_DIR, FIXTURES_DIR_2], {
    port: 0,
  });

  // Override hankDir for both projects (fixtures dirs contain data files directly)
  for (const [name, proj] of server.projects) {
    proj.hankDir = proj.projectPath;
  }

  await new Promise((resolve, reject) => {
    server.server = http.createServer((req, res) =>
      server.handleRequest(req, res)
    );
    server.server.listen(0, () => resolve());
    server.server.on("error", reject);
  });

  return server;
}

describe("Multi-project DashboardServer", () => {
  let server;
  let port;

  // Derived project names from path.basename
  const proj1Name = path.basename(FIXTURES_DIR); // "fixtures"
  const proj2Name = path.basename(FIXTURES_DIR_2); // "fixtures-project2"

  after(async () => {
    if (server) await server.stop();
  });

  it("registers both projects", async () => {
    server = await startMultiProjectServer();
    port = server.server.address().port;

    assert.equal(server.projects.size, 2);
    assert.ok(server.projects.has(proj1Name));
    assert.ok(server.projects.has(proj2Name));
  });

  it("GET /api/projects returns both projects", async () => {
    const res = await httpGet(`http://localhost:${port}/api/projects`);
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"].includes("application/json"));

    const projects = JSON.parse(res.body);
    assert.equal(projects.length, 2);

    const names = projects.map((p) => p.name);
    assert.ok(names.includes(proj1Name));
    assert.ok(names.includes(proj2Name));

    // Each project should have name and path
    for (const p of projects) {
      assert.ok(p.name);
      assert.ok(p.path);
    }
  });

  it("GET /api/data without project param returns primary project data", async () => {
    const res = await httpGet(`http://localhost:${port}/api/data`);
    assert.equal(res.status, 200);

    const data = JSON.parse(res.body);
    // Primary project (fixtures) has 5 loops
    assert.equal(data.costLog.length, 5);
    assert.equal(data.status.loopCount, 5);
  });

  it("GET /api/data?project=<name> returns correct project data", async () => {
    // Project 1 (fixtures): 5 loops, issues #1-3
    const res1 = await httpGet(
      `http://localhost:${port}/api/data?project=${proj1Name}`
    );
    assert.equal(res1.status, 200);
    const data1 = JSON.parse(res1.body);
    assert.equal(data1.costLog.length, 5);
    assert.equal(data1.status.loopCount, 5);

    // Project 2 (fixtures-project2): 3 cost log entries, 8 loops in status
    const res2 = await httpGet(
      `http://localhost:${port}/api/data?project=${proj2Name}`
    );
    assert.equal(res2.status, 200);
    const data2 = JSON.parse(res2.body);
    assert.equal(data2.costLog.length, 3);
    assert.equal(data2.status.loopCount, 8);
  });

  it("projects have distinct data (data isolation)", async () => {
    const res1 = await httpGet(
      `http://localhost:${port}/api/data?project=${proj1Name}`
    );
    const res2 = await httpGet(
      `http://localhost:${port}/api/data?project=${proj2Name}`
    );
    const data1 = JSON.parse(res1.body);
    const data2 = JSON.parse(res2.body);

    // Different session IDs
    assert.notEqual(data1.costSession.sessionId, data2.costSession.sessionId);

    // Different issue numbers
    const issues1 = [...new Set(data1.costLog.map((e) => e.issueNumber))];
    const issues2 = [...new Set(data2.costLog.map((e) => e.issueNumber))];
    // No overlap — project1 has 1,2,3 and project2 has 10,11
    for (const issue of issues1) {
      assert.ok(
        !issues2.includes(issue),
        `Issue ${issue} found in both projects`
      );
    }

    // Different circuit breaker states
    assert.equal(data1.circuitBreaker.state, "CLOSED");
    assert.equal(data2.circuitBreaker.state, "OPEN");
  });

  it("GET /api/data?project=nonexistent returns 404", async () => {
    const res = await httpGet(
      `http://localhost:${port}/api/data?project=nonexistent`
    );
    assert.equal(res.status, 404);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
  });

  it("GET /api/events?project=nonexistent returns 404", async () => {
    const res = await httpGet(
      `http://localhost:${port}/api/events?project=nonexistent`
    );
    assert.equal(res.status, 404);
  });

  it("SSE streams are project-specific", async () => {
    // Connect to project 1 SSE
    const data1 = await new Promise((resolve, reject) => {
      http
        .get(
          `http://localhost:${port}/api/events?project=${proj1Name}`,
          (res) => {
            assert.equal(res.headers["content-type"], "text/event-stream");
            let buf = "";
            res.on("data", (chunk) => {
              buf += chunk;
              if (buf.includes("\n\n")) {
                res.destroy();
                const jsonStr = buf.replace("data: ", "").trim();
                resolve(JSON.parse(jsonStr));
              }
            });
            res.on("error", (err) => {
              if (err.code !== "ECONNRESET") reject(err);
            });
          }
        )
        .on("error", reject);
    });

    assert.equal(data1.costLog.length, 5);
    assert.equal(data1.status.loopCount, 5);

    // Connect to project 2 SSE
    const data2 = await new Promise((resolve, reject) => {
      http
        .get(
          `http://localhost:${port}/api/events?project=${proj2Name}`,
          (res) => {
            assert.equal(res.headers["content-type"], "text/event-stream");
            let buf = "";
            res.on("data", (chunk) => {
              buf += chunk;
              if (buf.includes("\n\n")) {
                res.destroy();
                const jsonStr = buf.replace("data: ", "").trim();
                resolve(JSON.parse(jsonStr));
              }
            });
            res.on("error", (err) => {
              if (err.code !== "ECONNRESET") reject(err);
            });
          }
        )
        .on("error", reject);
    });

    assert.equal(data2.costLog.length, 3);
    assert.equal(data2.status.loopCount, 8);
  });

  it("SSE clients are tracked per project", async () => {
    const proj1 = server.projects.get(proj1Name);
    const proj2 = server.projects.get(proj2Name);

    // Clear any stale clients from previous tests
    proj1.sseClients.clear();
    proj2.sseClients.clear();

    // Connect to project 1 SSE and wait for initial data
    const res1 = await new Promise((resolve) => {
      http.get(
        `http://localhost:${port}/api/events?project=${proj1Name}`,
        (res) => {
          res.once("data", () => resolve(res));
        }
      );
    });

    // Project 1 should have 1 client, project 2 should have 0
    assert.equal(proj1.sseClients.size, 1);
    assert.equal(proj2.sseClients.size, 0);

    res1.destroy();
  });

  it("stop() cleans up all projects", async () => {
    // Create a fresh server to test cleanup
    const tmpServer = await startMultiProjectServer();
    const tmpPort = tmpServer.server.address().port;

    // Connect SSE clients to both projects
    const connect = (projName) =>
      new Promise((resolve) => {
        const req = http.get(
          `http://localhost:${tmpPort}/api/events?project=${projName}`
        );
        req.on("response", (res) => {
          res.once("data", () => resolve(res));
        });
      });

    await connect(proj1Name);
    await connect(proj2Name);

    // Both projects should have SSE clients
    for (const proj of tmpServer.projects.values()) {
      assert.ok(proj.sseClients.size > 0);
    }

    // Stop should clean up everything
    await tmpServer.stop();

    for (const proj of tmpServer.projects.values()) {
      assert.equal(proj.sseClients.size, 0);
      assert.equal(proj.watcher, null);
      assert.equal(proj.parentWatcher, null);
    }
  });
});
