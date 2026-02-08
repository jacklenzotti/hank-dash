/**
 * Parser for .hank/.retry_log — JSONL file with retry attempts and outcomes.
 * Each line is a JSON object representing one retry attempt.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseRetryLog(hankDir) {
  const filePath = path.join(hankDir, ".retry_log");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return [];

    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          const entry = JSON.parse(line);
          return {
            timestamp: entry.timestamp || null,
            strategy: entry.strategy || "unknown",
            attemptNumber: entry.attempt_number || 0,
            outcome: entry.outcome || "unknown", // success, failure, exhausted
            errorType: entry.error_type || null,
            delayMs: entry.delay_ms || 0,
            sessionId: entry.session_id || null,
            loop: entry.loop || null,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    console.error("Failed to parse .retry_log:", err.message);
    return [];
  }
}

module.exports = { parseRetryLog };
