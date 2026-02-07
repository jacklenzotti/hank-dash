/**
 * Parsers for circuit breaker state and history files.
 * .circuit_breaker_state — current CB state, failure counters, reason.
 * .circuit_breaker_history — state transition log.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseCircuitBreakerState(hankDir) {
  const filePath = path.join(hankDir, ".circuit_breaker_state");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return {
      state: data.state,
      lastChange: data.last_change,
      consecutiveNoProgress: data.consecutive_no_progress,
      consecutiveSameError: data.consecutive_same_error,
      consecutivePermissionDenials: data.consecutive_permission_denials,
      lastProgressLoop: data.last_progress_loop,
      totalOpens: data.total_opens,
      reason: data.reason,
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function parseCircuitBreakerHistory(hankDir) {
  const filePath = path.join(hankDir, ".circuit_breaker_history");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return [];

    const data = JSON.parse(content);
    if (!Array.isArray(data)) return [];

    return data.map((entry) => ({
      timestamp: entry.timestamp,
      fromState: entry.from_state,
      toState: entry.to_state,
      reason: entry.reason,
      loop: entry.loop,
    }));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

module.exports = { parseCircuitBreakerState, parseCircuitBreakerHistory };
