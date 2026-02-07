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
  };

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
      const last = data.costLog[data.costLog.length - 1];
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
          h.fromState +
          " → " +
          h.toState +
          " (" +
          h.reason +
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
        acc.input += e.inputTokens;
        acc.output += e.outputTokens;
        acc.cacheRead += e.cacheReadTokens;
        acc.cacheWrite += e.cacheWriteTokens;
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
            ? '<span class="timeline-issue">#' + e.issueNumber + "</span>"
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
      (analysis.confidence * 100).toFixed(0) + "%";
    els.analysisSummary.textContent = analysis.summary || "—";
    els.analysisFiles.innerHTML = (analysis.filesChanged || [])
      .map((f) => "<li>" + escapeHtml(f) + "</li>")
      .join("");
  }

  function renderExitSignals(data) {
    const signals = data.exitSignals;
    if (!signals) return;

    els.exitDone.textContent =
      signals.doneSignals.length > 0 ? signals.doneSignals.join(", ") : "none";
    els.exitTestLoops.textContent =
      signals.testOnlyLoops.length > 0
        ? signals.testOnlyLoops.join(", ")
        : "none";
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
      if (latestCost > avgCost * 3) {
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
      issues[key].duration += e.durationSeconds;
      issues[key].tokens += e.inputTokens + e.outputTokens;
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

  // --- Main Update Function ---

  function updateDashboard(data) {
    renderStatusBar(data);
    renderCircuitBreaker(data);
    renderStallDetection(data);
    renderCostChart(data);
    renderCumulativeCostChart(data);
    renderTokenChart(data);
    renderTimeline(data);
    renderPlan(data);
    renderAnalysis(data);
    renderIssueBurndown(data);
    renderExitSignals(data);
  }

  // --- SSE Connection ---

  function connectSSE() {
    const eventSource = new EventSource("/api/events");

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
      // Reconnect after 3 seconds
      setTimeout(connectSSE, 3000);
    };
  }

  // Start SSE connection
  connectSSE();
})();
