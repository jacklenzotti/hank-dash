const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseCostSession } = require("../../src/parsers/cost-session");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseCostSession", () => {
  it("parses session totals correctly", () => {
    const session = parseCostSession(FIXTURES_DIR);
    assert.equal(session.sessionId, "hank-1770442743-29176");
    assert.equal(session.totalCostUsd, 0.1167);
    assert.equal(session.totalInputTokens, 73620);
    assert.equal(session.totalOutputTokens, 15710);
    assert.equal(session.totalCacheReadTokens, 45200);
    assert.equal(session.totalCacheWriteTokens, 9500);
    assert.equal(session.totalDurationSeconds, 213.2);
    assert.equal(session.totalLoops, 5);
  });

  it("returns null for missing file", () => {
    const session = parseCostSession("/nonexistent/path");
    assert.equal(session, null);
  });
});
