/**
 * Parser for .hank/.hank_session_history — returns an array of past Hank sessions
 * with cost, duration, loops, and exit reason for comparison across runs.
 *
 * Handles two formats:
 * 1. Legacy: direct array of session summary objects
 * 2. State-transition log: array of {timestamp, from_state, to_state, reason, loop_number}
 *    which gets aggregated into session summaries.
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * Detect whether the data is a state-transition log (Hank's actual format).
 */
function isStateTransitionFormat(data) {
  return data.length > 0 && data[0].from_state !== undefined;
}

/**
 * Transform state transitions into session summary objects.
 * Each session_start → reset/project_complete sequence becomes one session.
 */
function aggregateTransitions(transitions) {
  const sessions = [];
  let current = null;

  for (const t of transitions) {
    if (t.reason === "session_start") {
      // Close any unclosed session before starting new one
      if (current) {
        sessions.push(current);
      }
      current = {
        started_at: t.timestamp,
        loops: 0,
        exit_reason: null,
        total_duration_seconds: null,
      };
    } else if (current) {
      if (t.reason === "loop_completed") {
        current.loops = t.loop_number || current.loops + 1;
      }
      // Terminal states end the session
      if (
        t.to_state === "reset" ||
        t.to_state === "completed" ||
        t.to_state === "stopped"
      ) {
        current.exit_reason = t.reason;
        if (current.started_at && t.timestamp) {
          const start = new Date(current.started_at);
          const end = new Date(t.timestamp);
          const diff = (end - start) / 1000;
          if (!isNaN(diff)) current.total_duration_seconds = diff;
        }
        sessions.push(current);
        current = null;
      }
    }
  }

  // Include in-progress session (no terminal state yet)
  if (current) {
    const last = transitions[transitions.length - 1];
    if (last.loop_number) current.loops = last.loop_number;
    current.exit_reason = "in_progress";
    sessions.push(current);
  }

  return sessions;
}

function parseSessionHistory(hankDir) {
  const filePath = path.join(hankDir, ".hank_session_history");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    if (isStateTransitionFormat(data)) {
      return aggregateTransitions(data);
    }

    return data;
  } catch {
    return [];
  }
}

module.exports = { parseSessionHistory };
