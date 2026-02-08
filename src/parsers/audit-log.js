/**
 * Parser for audit log — structured event timeline from .hank/audit_log.jsonl.
 * Returns last 100 events with type, timestamp, session_id, and details.
 * Also groups events by session for session replay functionality.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseAuditLog(hankDir) {
  const filePath = path.join(hankDir, "audit_log.jsonl");

  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return { events: [], sessions: {} };

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

    return { events, sessions };
  } catch (err) {
    if (err.code === "ENOENT") return { events: [], sessions: {} };
    console.error("Failed to parse audit_log.jsonl:", err.message);
    return { events: [], sessions: {} };
  }
}

module.exports = { parseAuditLog };
