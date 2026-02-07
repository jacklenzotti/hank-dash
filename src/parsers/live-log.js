/**
 * Parser for .hank/live.log — returns the last N lines of Hank's live output.
 * The log is a plain text file (not JSON), appended to as Hank runs.
 */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_TAIL_LINES = 200;

function parseLiveLog(hankDir, maxLines = DEFAULT_TAIL_LINES) {
  const filePath = path.join(hankDir, "live.log");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    // Return only the last maxLines to avoid sending huge payloads
    const tail = lines.slice(-maxLines);
    return tail;
  } catch {
    return [];
  }
}

module.exports = { parseLiveLog };
