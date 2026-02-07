# hank-dash

Live web dashboard for [Hank](https://github.com/jacklenzotti/hank) autonomous loop runs.

Visualizes cost tracking, circuit breaker state, loop progress, and GitHub issue burndown from Hank's JSON/JSONL output files.

## Install

Requires Node.js >= 20.

```bash
git clone https://github.com/jacklenzotti/hank-dash.git
cd hank-dash
npm link
```

This registers `hank-dash` as a global command. No dependencies to install.

## Usage

```bash
# Point at a Hank-managed project
hank-dash /path/to/my-project

# Opens browser to http://localhost:3274
```

### Options

```bash
hank-dash [project-path] [--port PORT] [--no-open]

  project-path   Path to a Hank-managed project (default: cwd)
  --port PORT    Server port (default: 3274)
  --no-open      Don't auto-open browser
```

### Without installing globally

```bash
node bin/hank-dash.js /path/to/my-project
```

## Features

- Real-time loop timeline with cost, duration, and files changed
- Cumulative and per-loop cost charts
- Circuit breaker state gauge with transition history
- Token efficiency breakdown (input/output/cache)
- GitHub issue burndown and per-issue cost tracking
- Stall detection warnings
