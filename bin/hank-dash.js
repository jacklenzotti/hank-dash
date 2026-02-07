#!/usr/bin/env node

/**
 * CLI entry point for hank-dash.
 * Usage: hank-dash [project-path] [--port PORT] [--no-open]
 *
 * Starts the dashboard server pointed at a Hank-managed project directory
 * and optionally opens the browser.
 */

const { DashboardServer } = require("../src/server");
const { exec } = require("node:child_process");

const DEFAULT_PORT = 3274;

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    projectPath: process.cwd(),
    port: DEFAULT_PORT,
    open: true,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      result.port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--no-open") {
      result.open = false;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: hank-dash [project-path] [--port PORT] [--no-open]

  project-path   Path to a Hank-managed project (default: cwd)
  --port PORT    Server port (default: ${DEFAULT_PORT})
  --no-open      Don't auto-open browser`);
      process.exit(0);
    } else if (!args[i].startsWith("-")) {
      result.projectPath = args[i];
    }
  }

  return result;
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`Open ${url} in your browser`);
    }
  });
}

async function main() {
  const config = parseArgs(process.argv);
  const server = new DashboardServer(config.projectPath, { port: config.port });

  try {
    await server.start();
    if (config.open) {
      openBrowser(`http://localhost:${config.port}`);
    }
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await server.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await server.stop();
    process.exit(0);
  });
}

main();
