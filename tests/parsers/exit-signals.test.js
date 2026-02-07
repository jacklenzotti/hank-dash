const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseExitSignals } = require("../../src/parsers/exit-signals");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseExitSignals", () => {
  it("parses exit signals correctly", () => {
    const signals = parseExitSignals(FIXTURES_DIR);
    assert.deepEqual(signals.testOnlyLoops, [4]);
    assert.deepEqual(signals.doneSignals, [
      "all_tests_passing",
      "implementation_complete",
    ]);
    assert.deepEqual(signals.completionIndicators, ["EXIT_SIGNAL: true"]);
  });

  it("returns null for missing file", () => {
    const signals = parseExitSignals("/nonexistent/path");
    assert.equal(signals, null);
  });
});
