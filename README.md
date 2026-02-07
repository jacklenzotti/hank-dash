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
hank-dash [project-path...] [--port PORT] [--no-open]

  project-path   One or more paths to Hank-managed projects (default: cwd)
  --port PORT    Server port (default: 3274)
  --no-open      Don't auto-open browser
```

### Multiple projects

Monitor several Hank projects from a single dashboard:

```bash
hank-dash /path/to/project-a /path/to/project-b /path/to/project-c
```

A project switcher dropdown appears in the header when multiple projects are loaded. Each project gets its own file watcher and SSE stream, so updates are isolated per project.

The server watches for `.hank/` directory creation, so you can point at a project before Hank has run there.

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
- Multi-project monitoring with project switcher UI
- Stall detection warnings
