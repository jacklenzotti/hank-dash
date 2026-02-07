# hank-dash

Live web dashboard for [Hank](https://github.com/jacklenzotti/hank) autonomous loop runs.

Visualizes cost tracking, circuit breaker state, loop progress, and GitHub issue burndown from Hank's JSON/JSONL output files.

## Usage

```bash
# Point at a Hank-managed project
hank-dash /path/to/my-project

# Opens browser to http://localhost:3274
```

## Features

- Real-time loop timeline with cost, duration, and files changed
- Cumulative and per-loop cost charts
- Circuit breaker state gauge with transition history
- Token efficiency breakdown (input/output/cache)
- GitHub issue burndown and per-issue cost tracking
- Stall detection warnings
