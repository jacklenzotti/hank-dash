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
      const totalCost = data.costLog.reduce((sum, e) => sum + e.costUsd, 0);
      const totalDuration = data.costLog.reduce(
        (sum, e) => sum + e.durationSeconds,
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

    const maxCost = Math.max(...entries.map((e) => e.costUsd));
    els.costChart.innerHTML = entries
      .map((e) => {
        const heightPct = maxCost > 0 ? (e.costUsd / maxCost) * 100 : 0;
        return (
          '<div class="chart-bar" style="height:' +
          heightPct +
          '%"' +
          ' title="Loop ' +
          e.loop +
          ": " +
          formatCost(e.costUsd) +
          '">' +
          '<span class="bar-label">' +
          formatCost(e.costUsd) +
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
    if (entries.length === 0) {
      els.loopTimeline.innerHTML =
        '<span style="color:var(--text-muted)">No loops yet</span>';
      return;
    }

    els.loopTimeline.innerHTML = entries
      .slice()
      .reverse()
      .map(
        (e) =>
          '<div class="timeline-entry">' +
          '<span class="timeline-loop">L' +
          e.loop +
          "</span>" +
          '<span class="timeline-cost">' +
          formatCost(e.costUsd) +
          "</span>" +
          '<span class="timeline-duration">' +
          formatDuration(e.durationSeconds) +
          "</span>" +
          (e.issueNumber
            ? '<span class="timeline-issue">#' + e.issueNumber + "</span>"
            : "") +
          "</div>"
      )
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

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- Main Update Function ---

  function updateDashboard(data) {
    renderStatusBar(data);
    renderCircuitBreaker(data);
    renderCostChart(data);
    renderTokenChart(data);
    renderTimeline(data);
    renderPlan(data);
    renderAnalysis(data);
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
