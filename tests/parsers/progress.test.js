const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseProgress } = require("../../src/parsers/progress");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseProgress", () => {
  it("parses progress fields correctly", () => {
    const progress = parseProgress(FIXTURES_DIR);
    assert.equal(progress.elapsedSeconds, 213.2);
    assert.equal(
      progress.lastOutput,
      "Implementing data parsers for cost tracking"
    );
    assert.equal(progress.currentLoop, 5);
    assert.equal(progress.startedAt, "2026-02-06T10:00:00+00:00");
  });

  it("returns null for missing file", () => {
    const progress = parseProgress("/nonexistent/path");
    assert.equal(progress, null);
  });
});
