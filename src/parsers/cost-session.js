/**
 * Parser for .cost_session — session-level cost/token/duration totals.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseCostSession(hankDir) {
  const filePath = path.join(hankDir, ".cost_session");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return {
      sessionId: data.session_id,
      totalCostUsd: data.total_cost_usd,
      totalInputTokens: data.total_input_tokens,
      totalOutputTokens: data.total_output_tokens,
      totalCacheReadTokens: data.total_cache_read_tokens || 0,
      totalCacheWriteTokens: data.total_cache_write_tokens || 0,
      totalDurationSeconds: data.total_duration_seconds,
      totalLoops: data.total_loops,
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

module.exports = { parseCostSession };
