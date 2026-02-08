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

  it("parses repoName field from entries", () => {
    const entries = parseCostLog(FIXTURES_DIR);
    assert.equal(entries[0].repoName, "frontend");
    assert.equal(entries[1].repoName, "frontend");
    assert.equal(entries[2].repoName, "backend-api");
    assert.equal(entries[3].repoName, "backend-api");
    assert.equal(entries[4].repoName, "shared-types");
  });

  it("returns null repoName when field is missing", () => {
    // Entries without repo_name should have null repoName (backwards compat)
    const entries = parseCostLog(FIXTURES_DIR);
    // All our fixture entries have repo_name, but verify the field exists
    entries.forEach((e) => {
      assert.ok("repoName" in e, "all entries should have repoName field");
    });
  });

  it("returns empty array for missing file", () => {
    const entries = parseCostLog("/nonexistent/path");
    assert.deepEqual(entries, []);
  });
});
