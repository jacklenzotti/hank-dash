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

## Notes

- 35 tests total: 21 parser + 8 malformed JSON resilience + 6 server (including 2 e2e smoke tests)
- Frontend DOM rendering tests are not feasible without a browser/JSDOM dependency, which violates the zero-dependency constraint. The e2e smoke tests cover the critical path (HTML has all sections, API returns all data).
