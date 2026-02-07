# Agents Operational Notes

## Running the Application

```bash
npm start                    # Start server (watches cwd/.hank/)
npm start /path/to/project   # Start server watching specific project
npm run dev                  # Start with --watch for hot reload
npm test                     # Run all tests (25 tests, ~1s)
PORT=8080 npm start          # Custom port (default: 3274)
```

## Key Architecture Decisions

- Server uses `DashboardServer` class (src/server.js) — instantiate with `new DashboardServer(projectPath, { port })` for testing
- Tests override `server.hankDir` to point at fixtures directory directly
- Test script glob: `'tests/**/*.test.js' 'tests/*.test.js'` — server tests live at tests root, parser tests in tests/parsers/
- File watcher uses 300ms debounce to batch rapid Hank writes
- All parsers are synchronous (fs.readFileSync) — appropriate for small JSON files
