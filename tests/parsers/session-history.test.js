const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseSessionHistory } = require("../../src/parsers/session-history");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseSessionHistory", () => {
  it("parses session history array", () => {
    const sessions = parseSessionHistory(FIXTURES_DIR);
    assert.ok(Array.isArray(sessions));
    assert.equal(sessions.length, 2);
  });

  it("contains expected session fields", () => {
    const sessions = parseSessionHistory(FIXTURES_DIR);
    const first = sessions[0];
    assert.equal(first.session_id, "sess_001");
    assert.equal(first.loops, 5);
    assert.equal(first.total_cost_usd, 0.45);
    assert.equal(first.total_duration_seconds, 300);
    assert.equal(first.exit_reason, "all_tests_passing");
  });

  it("returns empty array for missing file", () => {
    const sessions = parseSessionHistory("/nonexistent/path");
    assert.deepEqual(sessions, []);
  });
});
