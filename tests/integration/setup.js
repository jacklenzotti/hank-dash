/**
 * Test helper for Playwright integration tests.
 * Starts a DashboardServer on a random port pointed at the test fixtures
 * directory. Provides the base URL and tears down the server after tests.
 */

const path = require("node:path");
const http = require("node:http");
const { DashboardServer } = require("../../src/server");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

/**
 * Create and start a DashboardServer pointed at test fixtures.
 * Returns { server, baseUrl, port }.
 * Call server.stop() when done.
 */
async function startTestServer() {
  const server = new DashboardServer(FIXTURES_DIR, { port: 0 });
  // Point hankDir directly at fixtures (they contain the data files)
  server.hankDir = FIXTURES_DIR;

  await new Promise((resolve, reject) => {
    server.server = http.createServer((req, res) =>
      server.handleRequest(req, res)
    );
    server.server.listen(0, () => resolve());
    server.server.on("error", reject);
  });

  const port = server.server.address().port;
  const baseUrl = `http://localhost:${port}`;

  return { server, baseUrl, port };
}

module.exports = { startTestServer, FIXTURES_DIR };
