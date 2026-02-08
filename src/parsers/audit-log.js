/**
 * Parser for audit log — structured event timeline from .hank/audit_log.jsonl.
 * Returns last 100 events with type, timestamp, session_id, and details.
 * Also groups events by session for session replay functionality.
 * Extracts orchestration timeline from orchestration-type events.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseAuditLog(hankDir) {
  const filePath = path.join(hankDir, "audit_log.jsonl");

  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content)
      return { events: [], sessions: {}, orchestrationTimeline: [] };

    // Parse all events (JSONL format)
    const allEvents = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          const event = JSON.parse(line);
          return {
            type: event.type || "info",
            timestamp: event.timestamp || null,
            sessionId: event.session_id || event.sessionId || null,
            loop: event.loop || null,
            details: event.details || {},
            message: event.message || "",
            repoName:
              event.repo_name ||
              event.repoName ||
              (event.details &&
                (event.details.repo_name || event.details.repoName)) ||
              null,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Return last 100 events
    const events = allEvents.slice(-100);

    // Group events by session for replay functionality
    const sessions = {};
    allEvents.forEach((event) => {
      if (!event.sessionId) return;
      if (!sessions[event.sessionId]) {
        sessions[event.sessionId] = [];
      }
      sessions[event.sessionId].push(event);
    });

    // Build orchestration timeline from orchestration events
    const orchestrationTimeline = buildOrchestrationTimeline(allEvents);

    return { events, sessions, orchestrationTimeline };
  } catch (err) {
    if (err.code === "ENOENT")
      return { events: [], sessions: {}, orchestrationTimeline: [] };
    console.error("Failed to parse audit_log.jsonl:", err.message);
    return { events: [], sessions: {}, orchestrationTimeline: [] };
  }
}

/**
 * Extract orchestration timeline from audit events.
 * Looks for orchestration_start, orchestration_repo_start,
 * orchestration_repo_complete, and orchestration_complete events.
 * Returns an array of repo execution windows with start/end times.
 */
function buildOrchestrationTimeline(events) {
  const orchTypes = [
    "orchestration_start",
    "orchestration_repo_start",
    "orchestration_repo_complete",
    "orchestration_complete",
  ];

  const orchEvents = events.filter((e) => orchTypes.includes(e.type));
  if (orchEvents.length === 0) return [];

  // Track repo execution windows
  const repoWindows = {};
  let orchestrationStart = null;
  let orchestrationEnd = null;

  for (const event of orchEvents) {
    if (event.type === "orchestration_start") {
      orchestrationStart = event.timestamp;
    } else if (event.type === "orchestration_complete") {
      orchestrationEnd = event.timestamp;
    } else if (event.type === "orchestration_repo_start") {
      const repo =
        event.repoName || (event.details && event.details.repo) || "unknown";
      if (!repoWindows[repo]) {
        repoWindows[repo] = {
          name: repo,
          start: null,
          end: null,
          status: "in_progress",
          priority: event.details.priority || 0,
        };
      }
      repoWindows[repo].start = event.timestamp;
    } else if (event.type === "orchestration_repo_complete") {
      const repo =
        event.repoName || (event.details && event.details.repo) || "unknown";
      if (!repoWindows[repo]) {
        repoWindows[repo] = {
          name: repo,
          start: null,
          end: null,
          status: "completed",
          priority: event.details.priority || 0,
        };
      }
      repoWindows[repo].end = event.timestamp;
      repoWindows[repo].status =
        (event.details && event.details.status) || "completed";
    }
  }

  const timeline = Object.values(repoWindows).sort((a, b) => {
    // Sort by priority (lower first), then by start time
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.start && b.start) return new Date(a.start) - new Date(b.start);
    return 0;
  });

  return timeline.map((w) => ({
    name: w.name,
    start: w.start,
    end: w.end,
    status: w.status,
    priority: w.priority,
    orchestrationStart,
    orchestrationEnd,
  }));
}

module.exports = { parseAuditLog };
