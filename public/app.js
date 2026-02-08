/**
 * Frontend JavaScript: SSE client and DOM rendering for Hank Dashboard.
 * Connects to /api/events for real-time updates and renders all dashboard panels.
 */

(function () {
  "use strict";

  // DOM element references
  const els = {
    connectionStatus: document.getElementById("connection-status"),
    runStatus: document.getElementById("run-status"),
    loopCount: document.getElementById("loop-count"),
    totalCost: document.getElementById("total-cost"),
    totalDuration: document.getElementById("total-duration"),
    apiCalls: document.getElementById("api-calls"),
    cbState: document.getElementById("cb-state"),
    cbTotalOpens: document.getElementById("cb-total-opens"),
    cbNoProgress: document.getElementById("cb-no-progress"),
    cbSameError: document.getElementById("cb-same-error"),
    cbReason: document.getElementById("cb-reason"),
    cbHistory: document.getElementById("cb-history"),
    costChart: document.getElementById("cost-chart"),
    tokenChart: document.getElementById("token-chart"),
    loopTimeline: document.getElementById("loop-timeline"),
    planBar: document.getElementById("plan-bar"),
    planCount: document.getElementById("plan-count"),
    planTasks: document.getElementById("plan-tasks"),
    analysisConfidence: document.getElementById("analysis-confidence"),
    analysisSummary: document.getElementById("analysis-summary"),
    analysisFiles: document.getElementById("analysis-files"),
    exitDone: document.getElementById("exit-done"),
    exitTestLoops: document.getElementById("exit-test-loops"),
    stallSection: document.getElementById("stall-section"),
    stallContent: document.getElementById("stall-content"),
    cumulativeCostChart: document.getElementById("cumulative-cost-chart"),
    issueContent: document.getElementById("issue-content"),
    modelContent: document.getElementById("model-content"),
    cacheChart: document.getElementById("cache-chart"),
    estRemaining: document.getElementById("est-remaining"),
    velocityChart: document.getElementById("velocity-chart"),
    sessionHistoryContent: document.getElementById("session-history-content"),
    logToggle: document.getElementById("log-toggle"),
    logContainer: document.getElementById("log-container"),
    logContent: document.getElementById("log-content"),
    projectSelector: document.getElementById("project-selector"),
    processesContent: document.getElementById("processes-content"),
  };

  // Active project and SSE state
  let currentProject = null;
  let currentEventSource = null;

  // Log panel toggle + scroll lock state
  let logScrollLocked = false;
  if (els.logToggle) {
    els.logToggle.addEventListener("click", function () {
      const expanded = this.getAttribute("aria-expanded") === "true";
      this.setAttribute("aria-expanded", String(!expanded));
      els.logContainer.style.display = expanded ? "none" : "";
    });
  }
  if (els.logContent) {
    els.logContent.addEventListener("scroll", function () {
      // Lock auto-scroll when user scrolls up, unlock when at bottom
      const atBottom =
        this.scrollHeight - this.scrollTop - this.clientHeight < 20;
      logScrollLocked = !atBottom;
    });
  }

  // --- Rendering Functions ---

  function formatCost(usd) {
    if (usd == null) return "—";
    return "$" + usd.toFixed(4);
  }

  function formatDuration(seconds) {
    if (seconds == null) return "—";
    if (seconds < 60) return seconds.toFixed(1) + "s";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return mins + "m " + secs + "s";
  }

  function renderStatusBar(data) {
    const status = data.status;
    const session = data.costSession;

    if (status) {
      els.runStatus.textContent = status.status || "—";
      els.runStatus.className =
        "value " + (status.status === "running" ? "running" : "stopped");
      els.loopCount.textContent = status.loopCount || "—";
      els.apiCalls.textContent =
        (status.callsMadeThisHour || 0) + "/" + (status.maxCallsPerHour || "—");
    }

    if (session) {
      els.totalCost.textContent = formatCost(session.totalCostUsd);
      els.totalDuration.textContent = formatDuration(
        session.totalDurationSeconds
      );
    } else if (data.costLog && data.costLog.length > 0) {
      // Fall back to computing from cost log
      const totalCost = data.costLog.reduce((sum, e) => sum + loopCost(e), 0);
      const totalDuration = data.costLog.reduce(
        (sum, e) => sum + (e.durationSeconds || 0),
        0
      );
      els.totalCost.textContent = formatCost(totalCost);
      els.totalDuration.textContent = formatDuration(totalDuration);
    }
  }

  function renderCircuitBreaker(data) {
    const cb = data.circuitBreaker;
    if (!cb) return;

    const stateLC = cb.state.toLowerCase();
    els.cbState.textContent = cb.state;
    els.cbState.className = "cb-gauge " + stateLC;
    els.cbTotalOpens.textContent = cb.totalOpens;
    els.cbNoProgress.textContent = cb.consecutiveNoProgress;
    els.cbSameError.textContent = cb.consecutiveSameError;
    els.cbReason.textContent = cb.reason || "—";

    // History
    const history = data.circuitBreakerHistory || [];
    els.cbHistory.innerHTML = history
      .slice()
      .reverse()
      .map(
        (h) =>
          '<div class="history-item">' +
          "<strong>Loop " +
          h.loop +
          ":</strong> " +
          escapeHtml(h.fromState || "") +
          " → " +
          escapeHtml(h.toState || "") +
          " (" +
          escapeHtml(h.reason || "") +
          ")" +
          "</div>"
      )
      .join("");
  }

  function renderCostChart(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.costChart.innerHTML =
        '<span style="color:var(--text-muted)">No cost data yet</span>';
      return;
    }

    const maxCost = Math.max(...entries.map((e) => loopCost(e)));
    els.costChart.innerHTML = entries
      .map((e) => {
        const cost = loopCost(e);
        const heightPct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
        return (
          '<div class="chart-bar" style="height:' +
          heightPct +
          '%"' +
          ' title="Loop ' +
          e.loop +
          ": " +
          formatCost(cost) +
          '">' +
          '<span class="bar-label">' +
          formatCost(cost) +
          "</span>" +
          '<span class="bar-value">L' +
          e.loop +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderTokenChart(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.tokenChart.innerHTML =
        '<span style="color:var(--text-muted)">No token data yet</span>';
      return;
    }

    // Aggregate tokens across all loops
    const totals = entries.reduce(
      (acc, e) => {
        acc.input += e.inputTokens || 0;
        acc.output += e.outputTokens || 0;
        acc.cacheRead += e.cacheReadTokens || 0;
        acc.cacheWrite += e.cacheWriteTokens || 0;
        return acc;
      },
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    );

    const max = Math.max(
      totals.input,
      totals.output,
      totals.cacheRead,
      totals.cacheWrite
    );
    const bars = [
      { label: "Input", value: totals.input, cls: "input" },
      { label: "Output", value: totals.output, cls: "output" },
      { label: "Cache Read", value: totals.cacheRead, cls: "cache-read" },
      { label: "Cache Write", value: totals.cacheWrite, cls: "cache-write" },
    ];

    els.tokenChart.innerHTML = bars
      .map((b) => {
        const heightPct = max > 0 ? (b.value / max) * 100 : 0;
        return (
          '<div class="chart-bar ' +
          b.cls +
          '" style="height:' +
          heightPct +
          '%"' +
          ' title="' +
          b.label +
          ": " +
          b.value.toLocaleString() +
          '">' +
          '<span class="bar-label">' +
          b.value.toLocaleString() +
          "</span>" +
          '<span class="bar-value">' +
          b.label +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderTimeline(data) {
    const entries = data.costLog || [];
    const analysis = data.responseAnalysis;
    if (entries.length === 0) {
      els.loopTimeline.innerHTML =
        '<span style="color:var(--text-muted)">No loops yet</span>';
      return;
    }

    // Show files changed from response analysis on the latest loop
    els.loopTimeline.innerHTML = entries
      .slice()
      .reverse()
      .map((e, idx) => {
        const filesInfo =
          idx === 0 && analysis && analysis.filesChanged
            ? '<span class="timeline-files">' +
              analysis.filesChanged.length +
              " files</span>"
            : "";
        return (
          '<div class="timeline-entry">' +
          '<span class="timeline-loop">L' +
          e.loop +
          "</span>" +
          '<span class="timeline-cost">' +
          formatCost(loopCost(e)) +
          "</span>" +
          '<span class="timeline-duration">' +
          formatDuration(e.durationSeconds) +
          "</span>" +
          (e.issueNumber
            ? '<span class="timeline-issue">#' +
              escapeHtml(String(e.issueNumber)) +
              "</span>"
            : "") +
          filesInfo +
          "</div>"
        );
      })
      .join("");
  }

  function renderPlan(data) {
    const plan = data.implementationPlan;
    if (!plan || plan.totalCount === 0) {
      els.planBar.style.width = "0%";
      els.planCount.textContent = "0/0";
      els.planTasks.innerHTML =
        '<li style="color:var(--text-muted)">No tasks found</li>';
      return;
    }

    const pct =
      plan.totalCount > 0 ? (plan.completedCount / plan.totalCount) * 100 : 0;
    els.planBar.style.width = pct + "%";
    els.planCount.textContent = plan.completedCount + "/" + plan.totalCount;

    els.planTasks.innerHTML = plan.tasks
      .map(
        (t) =>
          "<li" +
          (t.completed ? ' class="completed"' : "") +
          ">" +
          escapeHtml(t.text) +
          "</li>"
      )
      .join("");
  }

  function renderAnalysis(data) {
    const analysis = data.responseAnalysis;
    if (!analysis) return;

    els.analysisConfidence.textContent =
      analysis.confidence != null
        ? (analysis.confidence * 100).toFixed(0) + "%"
        : "—";
    els.analysisSummary.textContent = analysis.summary || "—";
    els.analysisFiles.innerHTML = (analysis.filesChanged || [])
      .map((f) => "<li>" + escapeHtml(f) + "</li>")
      .join("");
  }

  function renderExitSignals(data) {
    const signals = data.exitSignals;
    if (!signals) return;

    const done = signals.doneSignals || [];
    const testLoops = signals.testOnlyLoops || [];
    els.exitDone.textContent = done.length > 0 ? done.join(", ") : "none";
    els.exitTestLoops.textContent =
      testLoops.length > 0 ? testLoops.join(", ") : "none";
  }

  function loopCost(entry) {
    return entry.costUsd || entry.totalCostUsd || 0;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCumulativeCostChart(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.cumulativeCostChart.innerHTML =
        '<span style="color:var(--text-muted)">No cost data yet</span>';
      return;
    }

    // Build cumulative cost array
    let cumulative = 0;
    const points = entries.map((e) => {
      cumulative += loopCost(e);
      return { loop: e.loop, total: cumulative };
    });

    const maxCost = points[points.length - 1].total;
    els.cumulativeCostChart.innerHTML = points
      .map((p) => {
        const heightPct = maxCost > 0 ? (p.total / maxCost) * 100 : 0;
        return (
          '<div class="chart-bar" style="height:' +
          heightPct +
          '%"' +
          ' title="After Loop ' +
          p.loop +
          ": " +
          formatCost(p.total) +
          '">' +
          '<span class="bar-label">' +
          formatCost(p.total) +
          "</span>" +
          '<span class="bar-value">L' +
          p.loop +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderStallDetection(data) {
    const cb = data.circuitBreaker;
    const entries = data.costLog || [];
    const warnings = [];

    // Check circuit breaker for no-progress stalls
    if (cb && cb.consecutiveNoProgress >= 2) {
      warnings.push(
        '<span class="stall-indicator high">NO PROGRESS</span> ' +
          cb.consecutiveNoProgress +
          " consecutive loops without progress"
      );
    }

    // Check for repeated same-error pattern
    if (cb && cb.consecutiveSameError >= 2) {
      warnings.push(
        '<span class="stall-indicator high">SAME ERROR</span> ' +
          cb.consecutiveSameError +
          " consecutive loops hitting the same error"
      );
    }

    // Check for circuit breaker being open
    if (cb && cb.state === "OPEN") {
      warnings.push(
        '<span class="stall-indicator high">CIRCUIT OPEN</span> ' +
          "Circuit breaker tripped" +
          (cb.reason ? ": " + escapeHtml(cb.reason) : "")
      );
    }

    // Check for cost anomalies — if latest loop cost is 3x the average
    if (entries.length >= 3) {
      const avgCost =
        entries.slice(0, -1).reduce((s, e) => s + loopCost(e), 0) /
        (entries.length - 1);
      const latest = entries[entries.length - 1];
      const latestCost = loopCost(latest);
      if (avgCost > 0 && latestCost > avgCost * 3) {
        warnings.push(
          '<span class="stall-indicator medium">COST SPIKE</span> ' +
            "Loop " +
            latest.loop +
            " cost (" +
            formatCost(latestCost) +
            ") is " +
            (latestCost / avgCost).toFixed(1) +
            "x the average (" +
            formatCost(avgCost) +
            ")"
        );
      }
    }

    // Check for cost velocity spikes — $/min exceeding 3x average
    if (entries.length >= 3) {
      const velocities = entries.map((e) => {
        const dMin = (e.durationSeconds || 0) / 60;
        return dMin > 0 ? loopCost(e) / dMin : 0;
      });
      const priorVelocities = velocities.slice(0, -1);
      const avgVel =
        priorVelocities.reduce((s, v) => s + v, 0) / priorVelocities.length;
      const latestVel = velocities[velocities.length - 1];
      if (avgVel > 0 && latestVel > avgVel * 3) {
        warnings.push(
          '<span class="stall-indicator medium">BURN RATE</span> ' +
            "Loop " +
            entries[entries.length - 1].loop +
            " velocity ($" +
            latestVel.toFixed(4) +
            "/min) is " +
            (latestVel / avgVel).toFixed(1) +
            "x the average ($" +
            avgVel.toFixed(4) +
            "/min)"
        );
      }
    }

    if (warnings.length > 0) {
      els.stallSection.style.display = "";
      els.stallContent.innerHTML = warnings.join("<br>");
    } else {
      els.stallSection.style.display = "none";
    }
  }

  function renderIssueBurndown(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.issueContent.innerHTML =
        '<span style="color:var(--text-muted)">No issue data yet</span>';
      return;
    }

    // Group cost entries by issue number
    const issues = {};
    for (const e of entries) {
      const key = e.issueNumber || "unassigned";
      if (!issues[key]) {
        issues[key] = { loops: 0, cost: 0, duration: 0, tokens: 0 };
      }
      issues[key].loops++;
      issues[key].cost += loopCost(e);
      issues[key].duration += e.durationSeconds || 0;
      issues[key].tokens += (e.inputTokens || 0) + (e.outputTokens || 0);
    }

    const rows = Object.entries(issues)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([issue, stats]) => {
        const issueLabel =
          issue === "unassigned"
            ? '<span style="color:var(--text-muted)">unassigned</span>'
            : '<span class="issue-number">#' +
              escapeHtml(String(issue)) +
              "</span>";
        return (
          "<tr>" +
          "<td>" +
          issueLabel +
          "</td>" +
          "<td>" +
          stats.loops +
          "</td>" +
          "<td>" +
          formatCost(stats.cost) +
          "</td>" +
          "<td>" +
          formatDuration(stats.duration) +
          "</td>" +
          "<td>" +
          (stats.tokens / 1000).toFixed(1) +
          "k</td>" +
          "</tr>"
        );
      })
      .join("");

    els.issueContent.innerHTML =
      '<table class="issue-table">' +
      "<thead><tr><th>Issue</th><th>Loops</th><th>Cost</th><th>Duration</th><th>Tokens</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table>";
  }

  function renderModelBreakdown(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.modelContent.innerHTML =
        '<span style="color:var(--text-muted)">No model data yet</span>';
      return;
    }

    // Group by model
    const models = {};
    for (const e of entries) {
      const model = e.model || "unknown";
      if (!models[model]) {
        models[model] = { loops: 0, cost: 0, inputTokens: 0, outputTokens: 0 };
      }
      models[model].loops++;
      models[model].cost += loopCost(e);
      models[model].inputTokens += e.inputTokens || 0;
      models[model].outputTokens += e.outputTokens || 0;
    }

    const rows = Object.entries(models)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([model, stats]) => {
        const totalTokens = stats.inputTokens + stats.outputTokens;
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(model) +
          "</td>" +
          "<td>" +
          stats.loops +
          "</td>" +
          "<td>" +
          formatCost(stats.cost) +
          "</td>" +
          "<td>" +
          (totalTokens / 1000).toFixed(1) +
          "k</td>" +
          "</tr>"
        );
      })
      .join("");

    els.modelContent.innerHTML =
      '<table class="issue-table">' +
      "<thead><tr><th>Model</th><th>Loops</th><th>Cost</th><th>Tokens</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table>";
  }

  function renderCacheHitRate(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.cacheChart.innerHTML =
        '<span style="color:var(--text-muted)">No cache data yet</span>';
      return;
    }

    const rates = entries.map((e) => {
      const totalInput =
        (e.inputTokens || 0) +
        (e.cacheReadTokens || 0) +
        (e.cacheWriteTokens || 0);
      return {
        loop: e.loop,
        rate:
          totalInput > 0 ? ((e.cacheReadTokens || 0) / totalInput) * 100 : 0,
      };
    });

    els.cacheChart.innerHTML = rates
      .map((r) => {
        const cls =
          r.rate >= 50
            ? "cache-bar-high"
            : r.rate >= 25
            ? "cache-bar-mid"
            : "cache-bar-low";
        return (
          '<div class="chart-bar ' +
          cls +
          '" style="height:' +
          r.rate +
          '%"' +
          ' title="Loop ' +
          r.loop +
          ": " +
          r.rate.toFixed(1) +
          '% cache hit">' +
          '<span class="bar-label">' +
          r.rate.toFixed(0) +
          "%</span>" +
          '<span class="bar-value">L' +
          r.loop +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderEstimatedRemaining(data) {
    const plan = data.implementationPlan;
    const entries = data.costLog || [];
    if (
      !plan ||
      plan.totalCount === 0 ||
      plan.completedCount === 0 ||
      entries.length === 0
    ) {
      els.estRemaining.textContent = "—";
      return;
    }

    const totalCost = entries.reduce((sum, e) => sum + loopCost(e), 0);
    const totalDuration = entries.reduce(
      (sum, e) => sum + (e.durationSeconds || 0),
      0
    );
    const remaining = plan.totalCount - plan.completedCount;
    const costPerTask = totalCost / plan.completedCount;
    const durationPerTask = totalDuration / plan.completedCount;

    const estCost = costPerTask * remaining;
    const estDuration = durationPerTask * remaining;

    els.estRemaining.textContent =
      formatCost(estCost) + " / " + formatDuration(estDuration);
  }

  function renderSessionHistory(data) {
    const sessions = data.sessionHistory || [];
    if (sessions.length === 0) {
      els.sessionHistoryContent.innerHTML =
        '<span style="color:var(--text-muted)">No session history yet</span>';
      return;
    }

    const rows = sessions
      .slice()
      .reverse()
      .map((s) => {
        const cost =
          s.total_cost_usd != null ? s.total_cost_usd : s.totalCostUsd;
        const duration =
          s.total_duration_seconds != null
            ? s.total_duration_seconds
            : s.totalDurationSeconds;
        const loops = s.loops || s.loop_count || "—";
        const exitReason = s.exit_reason || s.exitReason || "—";
        const startedAt = s.started_at || s.startedAt || "";
        const dateStr = startedAt ? new Date(startedAt).toLocaleString() : "—";
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(dateStr) +
          "</td>" +
          "<td>" +
          loops +
          "</td>" +
          "<td>" +
          formatCost(cost) +
          "</td>" +
          "<td>" +
          formatDuration(duration) +
          "</td>" +
          "<td>" +
          escapeHtml(String(exitReason)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    els.sessionHistoryContent.innerHTML =
      '<table class="issue-table">' +
      "<thead><tr><th>Started</th><th>Loops</th><th>Cost</th><th>Duration</th><th>Exit Reason</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table>";
  }

  function renderLiveLog(data) {
    const lines = data.liveLog || [];
    if (lines.length === 0) {
      els.logContent.textContent = "No log output yet...";
      return;
    }
    els.logContent.textContent = lines.join("\n");
    // Auto-scroll to bottom unless user has scrolled up
    if (!logScrollLocked) {
      els.logContent.scrollTop = els.logContent.scrollHeight;
    }
  }

  function renderCostVelocity(data) {
    const entries = data.costLog || [];
    if (entries.length === 0) {
      els.velocityChart.innerHTML =
        '<span style="color:var(--text-muted)">No velocity data yet</span>';
      return;
    }

    const velocities = entries.map((e) => {
      const durationMin = (e.durationSeconds || 0) / 60;
      return {
        loop: e.loop,
        velocity: durationMin > 0 ? loopCost(e) / durationMin : 0,
      };
    });

    const maxVel = Math.max(...velocities.map((v) => v.velocity));
    els.velocityChart.innerHTML = velocities
      .map((v) => {
        const heightPct = maxVel > 0 ? (v.velocity / maxVel) * 100 : 0;
        // Color-code: high velocity (>3x avg) is red, moderate is yellow, normal is accent
        const avgVel =
          velocities.reduce((s, x) => s + x.velocity, 0) / velocities.length;
        const cls =
          avgVel > 0 && v.velocity > avgVel * 3
            ? "velocity-high"
            : avgVel > 0 && v.velocity > avgVel * 1.5
            ? "velocity-mid"
            : "";
        return (
          '<div class="chart-bar ' +
          cls +
          '" style="height:' +
          heightPct +
          '%"' +
          ' title="Loop ' +
          v.loop +
          ": $" +
          v.velocity.toFixed(4) +
          '/min">' +
          '<span class="bar-label">$' +
          v.velocity.toFixed(3) +
          "</span>" +
          '<span class="bar-value">L' +
          v.loop +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function formatElapsed(elapsed) {
    if (!elapsed) return "—";
    // ps etime format: [[DD-]HH:]MM:SS
    return elapsed;
  }

  function truncateCommand(cmd, maxLen) {
    if (!cmd) return "—";
    return cmd.length > maxLen ? cmd.substring(0, maxLen) + "..." : cmd;
  }

  function renderProcesses(data) {
    const procs = data.processes;
    if (!procs) {
      els.processesContent.innerHTML =
        '<span style="color:var(--text-muted)">No process data</span>';
      return;
    }

    var html = "";

    // Tmux sessions
    if (procs.tmuxSessions.length > 0) {
      html +=
        '<div class="proc-group"><h3 class="proc-group-title">Tmux Sessions</h3>' +
        '<table class="issue-table"><thead><tr>' +
        "<th>Session</th><th>Windows</th><th>Status</th>" +
        "</tr></thead><tbody>";
      for (var i = 0; i < procs.tmuxSessions.length; i++) {
        var s = procs.tmuxSessions[i];
        if (s.raw) {
          html += '<tr><td colspan="3">' + escapeHtml(s.raw) + "</td></tr>";
        } else {
          html +=
            "<tr><td>" +
            escapeHtml(s.name) +
            "</td><td>" +
            (s.windows || "—") +
            "</td><td>" +
            (s.attached
              ? '<span class="proc-attached">attached</span>'
              : '<span class="proc-detached">detached</span>') +
            "</td></tr>";
        }
      }
      html += "</tbody></table></div>";
    }

    // Hank loops
    if (procs.hankProcesses.length > 0) {
      html +=
        '<div class="proc-group"><h3 class="proc-group-title">Hank Loops</h3>' +
        '<table class="issue-table"><thead><tr>' +
        "<th>PID</th><th>Elapsed</th><th>Command</th>" +
        "</tr></thead><tbody>";
      for (var i = 0; i < procs.hankProcesses.length; i++) {
        var p = procs.hankProcesses[i];
        html +=
          "<tr><td>" +
          p.pid +
          "</td><td>" +
          escapeHtml(formatElapsed(p.elapsed)) +
          "</td><td>" +
          escapeHtml(truncateCommand(p.command, 80)) +
          "</td></tr>";
      }
      html += "</tbody></table></div>";
    }

    // Claude instances
    if (procs.claudeProcesses.length > 0) {
      html +=
        '<div class="proc-group"><h3 class="proc-group-title">Claude Instances</h3>' +
        '<table class="issue-table"><thead><tr>' +
        "<th>PID</th><th>PPID</th><th>Elapsed</th><th>Command</th>" +
        "</tr></thead><tbody>";
      for (var i = 0; i < procs.claudeProcesses.length; i++) {
        var p = procs.claudeProcesses[i];
        html +=
          "<tr><td>" +
          p.pid +
          "</td><td>" +
          p.ppid +
          "</td><td>" +
          escapeHtml(formatElapsed(p.elapsed)) +
          "</td><td>" +
          escapeHtml(truncateCommand(p.command, 80)) +
          "</td></tr>";
      }
      html += "</tbody></table></div>";
    }

    // Orphans
    if (procs.orphans.length > 0) {
      html +=
        '<div class="proc-group proc-orphans"><h3 class="proc-group-title">Orphaned Processes</h3>' +
        '<table class="issue-table"><thead><tr>' +
        "<th>PID</th><th>PPID</th><th>Elapsed</th><th>Command</th>" +
        "</tr></thead><tbody>";
      for (var i = 0; i < procs.orphans.length; i++) {
        var p = procs.orphans[i];
        html +=
          '<tr class="orphan-row"><td>' +
          p.pid +
          "</td><td>" +
          p.ppid +
          "</td><td>" +
          escapeHtml(formatElapsed(p.elapsed)) +
          "</td><td>" +
          escapeHtml(truncateCommand(p.command, 80)) +
          "</td></tr>";
      }
      html += "</tbody></table></div>";
    }

    if (!html) {
      html =
        '<span style="color:var(--text-muted)">No hank-related processes running</span>';
    }

    els.processesContent.innerHTML = html;
  }

  function renderErrorCatalog(data) {
    const errors = data.errorCatalog || [];
    const container = document.getElementById("error-catalog-content");
    if (!container) return;

    if (errors.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No errors cataloged yet</div>';
      return;
    }

    let html = '<table class="error-catalog-table"><thead><tr>';
    html += "<th>Category</th>";
    html += "<th>Signature</th>";
    html += "<th>Count</th>";
    html += "<th>First Seen</th>";
    html += "<th>Last Seen</th>";
    html += "<th>Sample Message</th>";
    html += "</tr></thead><tbody>";

    errors.forEach((error) => {
      const categoryClass = error.category.toLowerCase();
      const firstSeen = error.firstSeen
        ? new Date(error.firstSeen).toLocaleString()
        : "—";
      const lastSeen = error.lastSeen
        ? new Date(error.lastSeen).toLocaleString()
        : "—";

      html += "<tr>";
      html +=
        '<td><span class="error-category ' +
        categoryClass +
        '">' +
        escapeHtml(error.category) +
        "</span></td>";
      html += "<td>" + escapeHtml(error.signature) + "</td>";
      html += "<td>" + error.count + "</td>";
      html += "<td>" + escapeHtml(firstSeen) + "</td>";
      html += "<td>" + escapeHtml(lastSeen) + "</td>";
      html +=
        '<td><span class="error-message">' +
        escapeHtml(error.sampleMessage) +
        "</span></td>";
      html += "</tr>";
    });

    html += "</tbody></table>";
    container.innerHTML = html;
  }

  function renderRetryActivity(data) {
    const retries = data.retryLog || [];
    const container = document.getElementById("retry-activity-content");
    if (!container) return;

    if (retries.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No retry activity yet</div>';
      return;
    }

    // Show most recent first
    const sorted = retries.slice().reverse();
    let html = '<div class="retry-timeline">';

    sorted.forEach((retry) => {
      const outcome = retry.outcome.toLowerCase();
      const timestamp = retry.timestamp
        ? new Date(retry.timestamp).toLocaleString()
        : "—";

      html += '<div class="retry-entry ' + outcome + '">';
      html +=
        '<span class="retry-badge ' +
        outcome +
        '">' +
        escapeHtml(retry.outcome) +
        "</span>";
      html += '<div class="retry-details">';
      html +=
        '<div class="retry-strategy">' +
        escapeHtml(retry.strategy) +
        " (Attempt " +
        retry.attemptNumber +
        ")</div>";
      html += '<div class="retry-meta">';
      if (retry.errorType) {
        html += "Error: " + escapeHtml(retry.errorType) + " &nbsp;|&nbsp; ";
      }
      if (retry.delayMs) {
        html += "Delay: " + retry.delayMs + "ms &nbsp;|&nbsp; ";
      }
      if (retry.loop) {
        html += "Loop: " + retry.loop;
      }
      html += "</div>";
      html += "</div>";
      html +=
        '<div class="retry-timestamp">' + escapeHtml(timestamp) + "</div>";
      html += "</div>";
    });

    html += "</div>";
    container.innerHTML = html;
  }

  // --- Main Update Function ---

  function updateDashboard(data) {
    renderStatusBar(data);
    renderCircuitBreaker(data);
    renderProcesses(data);
    renderStallDetection(data);
    renderCostChart(data);
    renderCumulativeCostChart(data);
    renderTokenChart(data);
    renderTimeline(data);
    renderPlan(data);
    renderAnalysis(data);
    renderIssueBurndown(data);
    renderModelBreakdown(data);
    renderCacheHitRate(data);
    renderEstimatedRemaining(data);
    renderCostVelocity(data);
    renderSessionHistory(data);
    renderLiveLog(data);
    renderExitSignals(data);
    renderErrorCatalog(data);
    renderRetryActivity(data);
  }

  // --- SSE Connection ---

  function connectSSE(projectName) {
    // Close existing connection if any
    if (currentEventSource) {
      currentEventSource.close();
      currentEventSource = null;
    }

    const url = projectName
      ? "/api/events?project=" + encodeURIComponent(projectName)
      : "/api/events";
    const eventSource = new EventSource(url);
    currentEventSource = eventSource;

    eventSource.onopen = function () {
      els.connectionStatus.textContent = "Connected";
      els.connectionStatus.className = "status-badge connected";
    };

    eventSource.onmessage = function (event) {
      try {
        const data = JSON.parse(event.data);
        updateDashboard(data);
      } catch (err) {
        console.error("Failed to parse SSE data:", err);
      }
    };

    eventSource.onerror = function () {
      els.connectionStatus.textContent = "Disconnected";
      els.connectionStatus.className = "status-badge disconnected";
      eventSource.close();
      currentEventSource = null;
      // Reconnect after 3 seconds
      setTimeout(function () {
        connectSSE(currentProject);
      }, 3000);
    };
  }

  // --- Project Switcher ---

  function switchProject(projectName) {
    currentProject = projectName;
    connectSSE(projectName);
    // Update page title
    if (projectName) {
      document.title = projectName + " — Hank Dashboard";
    } else {
      document.title = "Hank Dashboard";
    }
  }

  async function initProjects() {
    try {
      const res = await fetch("/api/projects");
      const projects = await res.json();

      if (projects.length > 1 && els.projectSelector) {
        // Populate selector
        els.projectSelector.innerHTML = "";
        for (const p of projects) {
          const opt = document.createElement("option");
          opt.value = p.name;
          opt.textContent = p.name;
          els.projectSelector.appendChild(opt);
        }
        els.projectSelector.style.display = "";

        // Switch on selection change
        els.projectSelector.addEventListener("change", function () {
          switchProject(this.value);
        });

        // Start with first project
        switchProject(projects[0].name);
      } else {
        // Single project — hide selector, connect without project param
        connectSSE();
      }
    } catch {
      // Fallback: connect without project param (backwards compat)
      connectSSE();
    }
  }

  // Initialize
  initProjects();
})();
