/**
 * Parser for .hank/.error_catalog — error signatures with categories, counts, and timestamps.
 * Returns an array of categorized errors with frequency and occurrence tracking.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseErrorCatalog(hankDir) {
  const filePath = path.join(hankDir, ".error_catalog");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    // Expected format: { errors: [ { category, signature, count, first_seen, last_seen, sample_message } ] }
    if (!data || !Array.isArray(data.errors)) {
      return [];
    }

    return data.errors.map((error) => ({
      category: error.category || "unknown",
      signature: error.signature || "",
      count: error.count || 0,
      firstSeen: error.first_seen || null,
      lastSeen: error.last_seen || null,
      sampleMessage: error.sample_message || "",
    }));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    console.error("Failed to parse .error_catalog:", err.message);
    return [];
  }
}

module.exports = { parseErrorCatalog };
