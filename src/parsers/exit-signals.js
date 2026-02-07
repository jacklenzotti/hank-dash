/**
 * Parser for .exit_signals — completion tracking (done_signals, test_loops).
 */

const fs = require("node:fs");
const path = require("node:path");

function parseExitSignals(hankDir) {
  const filePath = path.join(hankDir, ".exit_signals");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return {
      testOnlyLoops: data.test_only_loops || [],
      doneSignals: data.done_signals || [],
      completionIndicators: data.completion_indicators || [],
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

module.exports = { parseExitSignals };
