# CLAUDE.md

## Project Overview

hank-dash is a live web dashboard for visualizing Hank autonomous loop runs. It reads JSON/JSONL data files from a Hank-managed project's `.hank/` directory and serves a real-time web UI.

## Architecture

- **Zero dependencies** — uses only Node.js built-in modules (http, fs, path, events)
- **Server**: `src/server.js` — HTTP server + file watcher, serves API + static files
- **Frontend**: `public/` — vanilla HTML/CSS/JS, no build step
- **Data parsers**: `src/parsers/` — read and parse Hank's various data files

## Data Sources (from Hank's `.hank/` directory)

| File                       | Format     | Contains                                                  |
| -------------------------- | ---------- | --------------------------------------------------------- |
| `cost_log.jsonl`           | JSONL      | Per-loop cost, tokens, duration, session_id, issue_number |
| `.cost_session`            | JSON       | Session totals (cost, tokens, duration, loops)            |
| `.circuit_breaker_state`   | JSON       | Current CB state, failure counters, reason                |
| `.circuit_breaker_history` | JSON array | State transition log                                      |
| `.response_analysis`       | JSON       | Latest loop analysis (confidence, files, signals)         |
| `.exit_signals`            | JSON       | Completion tracking (done_signals, test_loops)            |
| `status.json`              | JSON       | Live status (loop count, API calls, rate limits)          |
| `progress.json`            | JSON       | Execution progress (elapsed, last output)                 |
| `IMPLEMENTATION_PLAN.md`   | Markdown   | Task list with checkboxes                                 |

## Key Commands

```bash
npm start              # Start the dashboard server
npm run dev            # Start with --watch for development
npm test               # Run all tests
```

## Tech Constraints

- Node.js >= 20 (uses built-in test runner, --watch flag)
- No npm dependencies — everything uses Node built-ins
- Frontend: vanilla JS, no frameworks, no build tools
- Server-Sent Events (SSE) for real-time updates (no WebSocket dependency)
- Port: 3274 (default, configurable via PORT env var)

## Testing

Tests use Node's built-in test runner (`node --test`).

```bash
npm test                           # All tests
node --test tests/parsers/         # Parser tests only
```
