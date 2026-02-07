/**
 * Parser for cost_log.jsonl — per-loop cost, tokens, duration, session_id, issue_number.
 * Each line is a JSON object representing one Hank loop iteration.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseCostLog(hankDir) {
  const filePath = path.join(hankDir, "cost_log.jsonl");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return [];

    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const entry = JSON.parse(line);
        return {
          timestamp: entry.timestamp,
          loop: entry.loop,
          costUsd: entry.cost_usd,
          totalCostUsd: entry.total_cost_usd,
          inputTokens: entry.input_tokens,
          outputTokens: entry.output_tokens,
          cacheReadTokens:
            entry.cache_read_input_tokens || entry.cache_read_tokens || 0,
          cacheWriteTokens:
            entry.cache_creation_input_tokens || entry.cache_write_tokens || 0,
          durationSeconds:
            entry.duration_ms != null
              ? entry.duration_ms / 1000
              : entry.duration_seconds,
          sessionId: entry.session_id,
          issueNumber: entry.issue_number,
          model: entry.model || "unknown",
        };
      });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

module.exports = { parseCostLog };
