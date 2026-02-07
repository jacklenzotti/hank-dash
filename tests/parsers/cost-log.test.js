const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseCostLog } = require("../../src/parsers/cost-log");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseCostLog", () => {
  it("parses all entries from JSONL file", () => {
    const entries = parseCostLog(FIXTURES_DIR);
    assert.equal(entries.length, 5);
  });

  it("parses first entry fields correctly", () => {
    const entries = parseCostLog(FIXTURES_DIR);
    const first = entries[0];
    assert.equal(first.timestamp, "2026-02-06T10:00:00Z");
    assert.equal(first.loop, 1);
    assert.equal(first.costUsd, 0.0234);
    assert.equal(first.inputTokens, 15420);
    assert.equal(first.outputTokens, 3210);
    assert.equal(first.cacheReadTokens, 8500);
    assert.equal(first.cacheWriteTokens, 2100);
    assert.equal(first.durationSeconds, 45.2);
    assert.equal(first.sessionId, "hank-1770442743-29176");
    assert.equal(first.issueNumber, 1);
    assert.equal(first.model, "claude-sonnet-4-5-20250929");
  });

  it("returns empty array for missing file", () => {
    const entries = parseCostLog("/nonexistent/path");
    assert.deepEqual(entries, []);
  });
});
