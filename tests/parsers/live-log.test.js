const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseLiveLog } = require("../../src/parsers/live-log");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseLiveLog", () => {
  it("parses log lines from live.log", () => {
    const lines = parseLiveLog(FIXTURES_DIR);
    assert.ok(Array.isArray(lines));
    assert.ok(lines.length > 0);
    assert.ok(lines.some((l) => l.includes("Starting loop 1")));
    assert.ok(lines.some((l) => l.includes("Loop 2 complete")));
  });

  it("respects maxLines parameter", () => {
    const lines = parseLiveLog(FIXTURES_DIR, 3);
    assert.ok(lines.length <= 3);
  });

  it("returns empty array for missing file", () => {
    const lines = parseLiveLog("/nonexistent/path");
    assert.deepEqual(lines, []);
  });
});
