/**
 * Parser for IMPLEMENTATION_PLAN.md — task list with checkboxes.
 * Extracts checked/unchecked items from markdown checkbox syntax.
 */

const fs = require("node:fs");
const path = require("node:path");

function parseImplementationPlan(hankDir) {
  const filePath = path.join(hankDir, "IMPLEMENTATION_PLAN.md");
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) return { tasks: [], completedCount: 0, totalCount: 0 };

    const tasks = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const checkboxMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (checkboxMatch) {
        tasks.push({
          completed: checkboxMatch[1] !== " ",
          text: checkboxMatch[2].trim(),
        });
      }
    }

    return {
      tasks,
      completedCount: tasks.filter((t) => t.completed).length,
      totalCount: tasks.length,
    };
  } catch (err) {
    if (err.code === "ENOENT")
      return { tasks: [], completedCount: 0, totalCount: 0 };
    throw err;
  }
}

module.exports = { parseImplementationPlan };
