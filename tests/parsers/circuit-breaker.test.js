const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  parseCircuitBreakerState,
  parseCircuitBreakerHistory,
} = require("../../src/parsers/circuit-breaker");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseCircuitBreakerState", () => {
  it("parses state fields correctly", () => {
    const state = parseCircuitBreakerState(FIXTURES_DIR);
    assert.equal(state.state, "CLOSED");
    assert.equal(state.consecutiveNoProgress, 0);
    assert.equal(state.consecutiveSameError, 0);
    assert.equal(state.lastProgressLoop, 5);
    assert.equal(state.totalOpens, 1);
    assert.equal(state.reason, "");
  });

  it("returns null for missing file", () => {
    const state = parseCircuitBreakerState("/nonexistent/path");
    assert.equal(state, null);
  });
});

describe("parseCircuitBreakerHistory", () => {
  it("parses all history entries", () => {
    const history = parseCircuitBreakerHistory(FIXTURES_DIR);
    assert.equal(history.length, 3);
  });

  it("parses transition fields correctly", () => {
    const history = parseCircuitBreakerHistory(FIXTURES_DIR);
    const first = history[0];
    assert.equal(first.fromState, "CLOSED");
    assert.equal(first.toState, "OPEN");
    assert.equal(first.reason, "consecutive_no_progress >= 3");
    assert.equal(first.loop, 3);
  });

  it("returns empty array for missing file", () => {
    const history = parseCircuitBreakerHistory("/nonexistent/path");
    assert.deepEqual(history, []);
  });
});
