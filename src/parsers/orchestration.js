/**
 * Parser for orchestration state — multi-repo orchestration with dependencies.
 * Parses .hank/.orchestration_state (per-repo status) and .hank/.repos.json (repo config).
 */

const fs = require("node:fs");
const path = require("node:path");

function parseOrchestration(hankDir) {
  const statePath = path.join(hankDir, ".orchestration_state");
  const reposPath = path.join(hankDir, ".repos.json");

  try {
    // Parse orchestration state (per-repo status)
    let state = null;
    try {
      const stateRaw = fs.readFileSync(statePath, "utf-8");
      state = JSON.parse(stateRaw);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Failed to parse .orchestration_state:", err.message);
      }
      // If state file doesn't exist, orchestration is not active
      return null;
    }

    // Parse repo config (optional — orchestration state may be self-contained)
    let repos = null;
    try {
      const reposRaw = fs.readFileSync(reposPath, "utf-8");
      repos = JSON.parse(reposRaw);
    } catch {
      // repos.json is optional
    }

    // Expected state format: { repos: [ { name, status, loops, cost, dependencies, blocked_by } ] }
    if (!state || !Array.isArray(state.repos)) {
      return null;
    }

    const repoList = state.repos.map((repo) => ({
      name: repo.name || "unknown",
      status: repo.status || "pending", // completed, in_progress, blocked, pending
      loops: repo.loops || 0,
      cost: repo.cost_usd != null ? repo.cost_usd : repo.costUsd || 0,
      dependencies: repo.dependencies || [],
      blockedBy: repo.blocked_by || repo.blockedBy || [],
    }));

    // Calculate overall progress
    const completed = repoList.filter((r) => r.status === "completed").length;
    const total = repoList.length;

    return {
      repos: repoList,
      totalRepos: total,
      completedRepos: completed,
      inProgressRepos: repoList.filter((r) => r.status === "in_progress")
        .length,
      blockedRepos: repoList.filter((r) => r.status === "blocked").length,
      config: repos, // May be null if .repos.json doesn't exist
    };
  } catch (err) {
    console.error("Failed to parse orchestration data:", err.message);
    return null;
  }
}

module.exports = { parseOrchestration };
