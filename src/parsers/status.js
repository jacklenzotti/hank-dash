/**
 * Parser for status.json — live status (loop count, API calls, rate limits).
 */

const fs = require("node:fs");
const path = require("node:path");

function parseStatus(hankDir) {
  const filePath = path.join(hankDir, "status.json");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return {
      timestamp: data.timestamp,
      loopCount: data.loop_count,
      callsMadeThisHour: data.calls_made_this_hour,
      maxCallsPerHour: data.max_calls_per_hour,
      lastAction: data.last_action,
      status: data.status,
      exitReason: data.exit_reason,
      nextReset: data.next_reset,
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

module.exports = { parseStatus };
