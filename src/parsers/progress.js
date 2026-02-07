/**
 * Parser for progress.json — execution progress (elapsed, last output).
 */

const fs = require("node:fs");
const path = require("node:path");

function parseProgress(hankDir) {
  const filePath = path.join(hankDir, "progress.json");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return {
      elapsedSeconds: data.elapsed_seconds,
      lastOutput: data.last_output,
      currentLoop: data.current_loop,
      startedAt: data.started_at,
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    console.error("Failed to parse progress.json:", err.message);
    return null;
  }
}

module.exports = { parseProgress };
