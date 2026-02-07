/**
 * HTTP server with SSE real-time updates for the Hank dashboard.
 * Watches .hank/ directory for file changes and pushes updates via Server-Sent Events.
 * Serves static files from public/ and API endpoints for dashboard data.
 *
 * Zero dependencies — uses only Node.js built-in modules.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { parseAll } = require("./parsers");

const DEFAULT_PORT = 3274;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

class DashboardServer {
  constructor(projectPath, options = {}) {
    this.projectPath = path.resolve(projectPath);
    this.hankDir = path.join(this.projectPath, ".hank");
    this.port = options.port || DEFAULT_PORT;
    this.emitter = new EventEmitter();
    this.sseClients = new Set();
    this.watcher = null;
    this.server = null;
    this.debounceTimer = null;
  }

  /**
   * Read all Hank data files and return unified dashboard state.
   */
  getData() {
    return parseAll(this.hankDir);
  }

  /**
   * Start watching .hank/ directory for changes.
   */
  startWatching() {
    if (!fs.existsSync(this.hankDir)) {
      console.error(
        `Warning: ${this.hankDir} does not exist yet. Watching for creation...`
      );
      // Watch parent directory for .hank creation
      const parentWatcher = fs.watch(
        this.projectPath,
        (eventType, filename) => {
          if (filename === ".hank" && fs.existsSync(this.hankDir)) {
            parentWatcher.close();
            this._watchHankDir();
          }
        }
      );
      return;
    }
    this._watchHankDir();
  }

  _watchHankDir() {
    try {
      this.watcher = fs.watch(this.hankDir, { recursive: false }, () => {
        // Debounce: Hank writes multiple files in rapid succession
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.broadcastUpdate(), 300);
      });
    } catch (err) {
      console.error(`Error watching ${this.hankDir}:`, err.message);
    }
  }

  /**
   * Broadcast current state to all SSE clients.
   */
  broadcastUpdate() {
    const data = this.getData();
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Handle incoming HTTP requests.
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);

    // API endpoint: return current data as JSON
    if (url.pathname === "/api/data") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      });
      res.end(JSON.stringify(this.getData()));
      return;
    }

    // SSE endpoint: stream real-time updates
    if (url.pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      // Send initial data immediately
      const data = this.getData();
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      this.sseClients.add(res);

      req.on("close", () => {
        this.sseClients.delete(res);
      });
      return;
    }

    // Static file serving from public/
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    filePath = path.join(PUBLIC_DIR, filePath);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      if (url.pathname !== "/favicon.ico") {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        res.writeHead(204);
        res.end();
      }
    }
  }

  /**
   * Start the HTTP server and file watcher.
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) =>
        this.handleRequest(req, res)
      );

      this.server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`Port ${this.port} is already in use.`);
        }
        reject(err);
      });

      this.server.listen(this.port, () => {
        console.log(`hank-dash running at http://localhost:${this.port}`);
        console.log(`Watching: ${this.hankDir}`);
        this.startWatching();
        resolve(this.server);
      });
    });
  }

  /**
   * Stop the server and file watcher.
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    clearTimeout(this.debounceTimer);
    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

// If run directly (not imported), start the server
if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  const port = parseInt(process.env.PORT, 10) || DEFAULT_PORT;

  const server = new DashboardServer(projectPath, { port });
  server.start().catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });

  // Graceful shutdown
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

module.exports = { DashboardServer };
