# Implementation Plan

## Completed

- [x] Data parsers for all 8 Hank data files (cost_log, cost_session, circuit_breaker_state, circuit_breaker_history, response_analysis, exit_signals, status, progress, implementation_plan)
- [x] Parser index aggregator (parseAll)
- [x] Parser tests — 21 tests covering all parsers with fixtures
- [x] HTTP server with DashboardServer class (src/server.js)
- [x] SSE endpoint at /api/events for real-time updates
- [x] JSON API endpoint at /api/data
- [x] Static file serving from public/
- [x] File watcher on .hank/ directory with 300ms debounce
- [x] CLI entry point (bin/hank-dash.js) with --port, --no-open, --help
- [x] Server tests — 6 tests covering API, SSE, static serving, 404, e2e smoke tests
- [x] Frontend: status bar (status, loop count, cost, duration, API calls)
- [x] Frontend: circuit breaker gauge with transition history
- [x] Frontend: per-loop cost bar chart
- [x] Frontend: cumulative cost bar chart
- [x] Frontend: token efficiency breakdown (input/output/cache read/cache write)
- [x] Frontend: loop timeline with cost, duration, issue number, files changed
- [x] Frontend: implementation plan progress bar and task list
- [x] Frontend: response analysis panel (confidence, summary, files changed)
- [x] Frontend: exit signals panel
- [x] Frontend: stall detection warnings (no progress, same error, circuit open, cost spikes)
- [x] Frontend: GitHub issue cost breakdown table (per-issue loops, cost, duration, tokens)
- [x] SSE auto-reconnect on disconnect (3s retry)
- [x] Dark theme with monospace typography
- [x] Responsive layout (2-column grid, 1-column on mobile)
- [x] Directory traversal prevention in static file serving
- [x] Graceful shutdown (SIGINT/SIGTERM)
- [x] End-to-end smoke test (HTML sections + API data completeness)
- [x] Parser resilience: all parsers gracefully handle malformed JSON (return safe defaults, log errors)
- [x] XSS prevention: all dynamic data in innerHTML is escaped via escapeHtml()
- [x] Frontend null safety: token aggregation, exit signals, analysis confidence handle missing fields
- [x] Server: parent watcher tracked and cleaned up on stop() to prevent memory leaks
- [x] Stall detection: cost spike check guards against avgCost=0 false positives
- [x] Malformed JSON tests — 8 tests verifying parser resilience to corrupted files
- [x] Session filtering: parseAll filters cost log to current session only (filterToLatestSession)
- [x] [#12] Model usage breakdown — table grouped by model with loops, cost, tokens
- [x] [#8] Cache hit rate metric — per-loop bar chart with color-coded thresholds
- [x] [#10] Estimated remaining cost/time — in status bar, computed from plan completion rate
- [x] [#9] Cost velocity tracking — \$/min per loop bar chart with color-coded spikes, integrated into stall detection
- [x] [#7] Live log tail panel — collapsible terminal-style panel, auto-scroll with scroll-lock, reads .hank/live.log
- [x] [#11] Session history — parser for .hank_session_history, table with date/loops/cost/duration/exit reason
- [x] Bug fix: updateDashboard was not calling renderModelBreakdown, renderCacheHitRate, renderEstimatedRemaining
- [x] New parsers: live-log.js (text file), session-history.js (JSON array)
- [x] Tests expanded: 41 tests total (27 parser + 8 malformed JSON + 6 server)
- [x] Smoke tests updated to verify new HTML sections and API data keys
- [x] [#13] Playwright integration test infrastructure — playwright.config.js, setup.js helper, smoke.spec.js (6 tests)
- [x] [#16] Multi-project server support — DashboardServer accepts array of project paths, /api/projects endpoint, per-project ?project= query params on /api/data and /api/events
- [x] [#14] Playwright tests for dashboard panel rendering — panels.spec.js (18 tests covering all panels)
- [x] [#15] Playwright tests for SSE updates and interactivity — live-updates.spec.js (4 tests), interactivity.spec.js (7 tests)
- [x] [#17] Frontend project switcher UI — dropdown selector, project-specific SSE, page title update
- [x] [#18] Multi-project tests — unit tests (10 tests in multi-project.test.js) covering /api/projects, per-project /api/data, per-project SSE, data isolation, error handling, cleanup; Playwright integration tests (10 tests in multi-project.spec.js) covering project selector UI, project switching, data isolation, circuit breaker state, page title, and API verification
- [x] [#19] Error catalog and retry activity panels — parseErrorCatalog and parseRetryLog parsers, HTML sections for error catalog and retry activity, CSS styling with color-coded categories (persistent/transient/resolved) and retry outcomes (success/failure/exhausted), frontend render functions, 13 new tests (7 parser + 6 malformed JSON), smoke tests updated
- [x] [#20] Orchestration overview panel — parseOrchestration parser for .hank/.orchestration_state, HTML section with overall progress (X/Y repos complete), repo status table with per-repo status badges (completed=green, in_progress=blue, blocked=yellow, pending=gray), loops, cost, and dependencies, panel shows/hides based on orchestration data presence, frontend renderOrchestration function, 10 new tests (8 parser + 2 malformed JSON), smoke tests updated
- [x] [#21] Audit timeline and session replay panels — parseAuditLog parser for audit_log.jsonl (JSONL with structured events), returns last 100 events with type/timestamp/session_id/loop/message/details, groups events by session for session replay, Audit Timeline panel with filterable event types (errors/circuit-breaker/completion/info) via checkboxes, Session Replay panel with session selector dropdown showing per-loop breakdown, color-coded event badges (error=red, circuit-breaker=yellow, completion=green, info=blue), interactive filters that re-render timeline in real-time, session summary with session ID/total events/loop count, frontend render functions renderAuditTimeline and renderSessionReplay, event listeners for filter checkboxes and session selector, 11 new tests (9 parser + 2 malformed JSON), smoke tests updated

- [x] [#22] Orchestration timeline view — enhanced audit-log parser to extract orchestration events (orchestration_start, orchestration_repo_start, orchestration_repo_complete, orchestration_complete), builds orchestrationTimeline array with per-repo execution windows (start/end times, status, priority), horizontal bar chart showing repo execution windows sorted by priority then start time, time axis with start/end labels, status-colored bars (completed=green, in_progress=blue with striped animation, failed=red, pending=gray), section auto-hides when no orchestration data, 4 new audit-log tests for orchestration timeline extraction, smoke tests updated
- [x] [#23] Per-repo cost breakdown chart — added repoName field to cost-log parser (from repo_name in cost_log.jsonl), bar chart showing cost per repository with color-coded bars (8-color palette), legend with color swatches, summary table with per-repo loops/cost/duration/tokens, gracefully hidden when no repo_name data (backwards compatible with non-orchestration runs), 2 new cost-log tests for repoName parsing, server smoke tests updated to verify new data fields

- [x] [#24] fix: Session Replay panel shows empty when sessions exist — auto-select the most recent session on first render instead of showing "Select a session" empty state when session data is available, removed the placeholder "Choose a session" option so dropdown always starts with a real session
- [x] [#25] fix: Exit Signals panel shows dashes after session reset — when exitSignals is null (file empty/reset/missing), renderExitSignals now sets "none" text instead of returning early and leaving stale "—" dashes in the DOM

## Summary

**All GitHub issues (#19–#25) are now complete.**

## Notes

- 101 unit tests total: 57 parser + 15 malformed JSON resilience + 6 server + 10 multi-project server + 13 new (audit-log orchestration + cost-log repoName)
- 47 Playwright integration tests: 8 smoke + 18 panel + 4 live-update + 7 interactivity + 10 multi-project
- Frontend DOM rendering tests are not feasible without a browser/JSDOM dependency, which violates the zero-dependency constraint. The e2e smoke tests cover the critical path (HTML has all sections, API returns all data).
