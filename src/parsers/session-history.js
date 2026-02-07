/**
 * Parser for .hank/.hank_session_history — returns an array of past Hank sessions
 * with cost, duration, loops, and exit reason for comparison across runs.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseSessionHistory(hankDir) {
  const filePath = path.join(hankDir, ".hank_session_history");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

module.exports = { parseSessionHistory };
