const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  parseResponseAnalysis,
} = require("../../src/parsers/response-analysis");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseResponseAnalysis", () => {
  it("parses response analysis correctly", () => {
    const analysis = parseResponseAnalysis(FIXTURES_DIR);
    assert.equal(analysis.confidence, 0.85);
    assert.deepEqual(analysis.filesChanged, [
      "src/server.js",
      "src/parsers/cost.js",
    ]);
    assert.equal(analysis.signals.tests_passing, true);
    assert.equal(analysis.signals.new_errors, false);
    assert.equal(
      analysis.summary,
      "Implemented cost parser with JSONL support"
    );
    assert.equal(analysis.loop, 5);
  });

  it("returns null for missing file", () => {
    const analysis = parseResponseAnalysis("/nonexistent/path");
    assert.equal(analysis, null);
  });
});
