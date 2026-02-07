const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseStatus } = require("../../src/parsers/status");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseStatus", () => {
  it("parses status fields correctly", () => {
    const status = parseStatus(FIXTURES_DIR);
    assert.equal(status.loopCount, 5);
    assert.equal(status.callsMadeThisHour, 5);
    assert.equal(status.maxCallsPerHour, 100);
    assert.equal(status.lastAction, "executing");
    assert.equal(status.status, "running");
  });

  it("returns null for missing file", () => {
    const status = parseStatus("/nonexistent/path");
    assert.equal(status, null);
  });
});
