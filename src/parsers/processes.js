/**
 * Parser for system-level process info — tmux sessions, Claude PIDs, hank loops.
 * Unlike other parsers, this runs shell commands rather than reading .hank/ files.
 */

const { execSync } = require("node:child_process");

function getTmuxSessions() {
  try {
    const output = execSync("tmux list-sessions 2>/dev/null", {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .filter((line) => line.includes("hank"))
      .map((line) => {
        // Format: "session-name: N windows (created ...)" or with "(attached)"
        const match = line.match(
          /^([^:]+):\s+(\d+)\s+windows?\s+\(created[^)]*\)\s*(\(attached\))?/
        );
        if (!match) return { raw: line };
        return {
          name: match[1].trim(),
          windows: parseInt(match[2], 10),
          attached: !!match[3],
        };
      });
  } catch {
    return [];
  }
}

function getProcesses(pattern, excludePattern) {
  try {
    let cmd = `ps -eo pid,ppid,etime,command 2>/dev/null | grep -i "${pattern}" | grep -v grep`;
    if (excludePattern) {
      cmd += ` | grep -v "${excludePattern}"`;
    }
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const trimmed = line.trim();
        const parts = trimmed.split(/\s+/);
        if (parts.length < 4) return null;
        return {
          pid: parseInt(parts[0], 10),
          ppid: parseInt(parts[1], 10),
          elapsed: parts[2],
          command: parts.slice(3).join(" "),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function detectOrphans(claudeProcesses, hankProcesses) {
  if (claudeProcesses.length === 0) return [];

  // Collect all PIDs that are "valid parents" — hank_loop processes and tmux server
  const validParentPids = new Set();
  for (const p of hankProcesses) {
    validParentPids.add(p.pid);
  }

  // Also get tmux server PIDs
  try {
    const output = execSync(
      'ps -eo pid,command 2>/dev/null | grep "tmux" | grep -v grep',
      { encoding: "utf-8", timeout: 3000 }
    ).trim();
    if (output) {
      for (const line of output.split("\n")) {
        const pid = parseInt(line.trim().split(/\s+/)[0], 10);
        if (!isNaN(pid)) validParentPids.add(pid);
      }
    }
  } catch {
    // ignore
  }

  // A claude process is orphaned if its ppid is not a hank or tmux process
  // and its ppid is not 1 (which would mean reparented to init, also suspicious)
  return claudeProcesses.filter((cp) => {
    // Walk up: if ppid is in validParentPids, it's managed
    if (validParentPids.has(cp.ppid)) return false;

    // Check if ppid's parent is a valid parent (one level up)
    try {
      const output = execSync(`ps -o ppid= -p ${cp.ppid} 2>/dev/null`, {
        encoding: "utf-8",
        timeout: 2000,
      }).trim();
      const grandparentPid = parseInt(output, 10);
      if (!isNaN(grandparentPid) && validParentPids.has(grandparentPid)) {
        return false;
      }
    } catch {
      // can't look up parent — treat as orphan
    }

    return true;
  });
}

function getClaudeCliProcesses() {
  try {
    const output = execSync("ps -eo pid,ppid,etime,command 2>/dev/null", {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .filter((line) => {
        // Match only "claude" as the actual command, not as part of a path
        // e.g. "claude --resume ..." or "/usr/local/bin/claude ..."
        // but NOT "/Application Support/Claude/Extensions/..." or "Claude.app"
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) return false;
        const cmd = parts.slice(3).join(" ");
        // Command must start with "claude" or end with "/claude" (the binary itself)
        return (
          /(?:^|\/)claude(?:\s|$)/i.test(cmd) &&
          !cmd.includes("Claude.app") &&
          !cmd.includes("Claude Extensions") &&
          !cmd.includes("Claude Helper")
        );
      })
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0], 10),
          ppid: parseInt(parts[1], 10),
          elapsed: parts[2],
          command: parts.slice(3).join(" "),
        };
      });
  } catch {
    return [];
  }
}

function parseProcesses() {
  const claudeProcesses = getClaudeCliProcesses();
  const hankProcesses = getProcesses("hank_loop");
  return {
    tmuxSessions: getTmuxSessions(),
    claudeProcesses,
    hankProcesses,
    orphans: detectOrphans(claudeProcesses, hankProcesses),
  };
}

module.exports = { parseProcesses };
