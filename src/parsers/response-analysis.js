/**
 * Parser for .response_analysis — latest loop analysis (confidence, files, signals).
 */

const fs = require("node:fs");
const path = require("node:path");

function parseResponseAnalysis(hankDir) {
  const filePath = path.join(hankDir, ".response_analysis");
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const data = JSON.parse(content);
    return {
      confidence: data.confidence,
      filesChanged: data.files_changed || [],
      signals: data.signals || {},
      summary: data.summary || "",
      loop: data.loop,
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

module.exports = { parseResponseAnalysis };
