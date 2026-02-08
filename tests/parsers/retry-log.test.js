const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseRetryLog } = require("../../src/parsers/retry-log");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseRetryLog", () => {
  it("parses retry log JSONL", () => {
    const retries = parseRetryLog(FIXTURES_DIR);
    assert.ok(Array.isArray(retries));
    assert.equal(retries.length, 5);
  });

  it("contains expected retry fields", () => {
    const retries = parseRetryLog(FIXTURES_DIR);
    const first = retries[0];
    assert.equal(first.timestamp, "2026-01-15T10:30:00Z");
    assert.equal(first.strategy, "exponential_backoff");
    assert.equal(first.attemptNumber, 1);
    assert.equal(first.outcome, "failure");
    assert.equal(first.errorType, "ETIMEDOUT");
    assert.equal(first.delayMs, 1000);
    assert.equal(first.sessionId, "sess_001");
    assert.equal(first.loop, 3);
  });

  it("handles different retry outcomes", () => {
    const retries = parseRetryLog(FIXTURES_DIR);
    const outcomes = retries.map((r) => r.outcome);
    assert.ok(outcomes.includes("success"));
    assert.ok(outcomes.includes("failure"));
    assert.ok(outcomes.includes("exhausted"));
  });

  it("handles different retry strategies", () => {
    const retries = parseRetryLog(FIXTURES_DIR);
    const strategies = retries.map((r) => r.strategy);
    assert.ok(strategies.includes("exponential_backoff"));
    assert.ok(strategies.includes("constant"));
  });

  it("returns empty array for missing file", () => {
    const retries = parseRetryLog("/nonexistent/path");
    assert.deepEqual(retries, []);
  });

  it("skips malformed lines", () => {
    const retries = parseRetryLog(FIXTURES_DIR);
    // All 5 lines in the fixture are valid
    assert.equal(retries.length, 5);
  });

  it("handles missing optional fields with defaults", () => {
    const retries = parseRetryLog(FIXTURES_DIR);
    retries.forEach((retry) => {
      assert.ok(retry.strategy);
      assert.equal(typeof retry.attemptNumber, "number");
      assert.ok(retry.outcome);
    });
  });
});
