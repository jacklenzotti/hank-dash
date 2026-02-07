/**
 * HTTP server with SSE real-time updates for the Hank dashboard.
 * Watches .hank/ directories for file changes and pushes updates via Server-Sent Events.
 * Supports multiple projects — each with its own watcher and SSE stream.
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
  constructor(projectPaths, options = {}) {
    this.port = options.port || DEFAULT_PORT;
    this.emitter = new EventEmitter();
    this.server = null;

    // Normalize: accept single path or array
    const paths = Array.isArray(projectPaths) ? projectPaths : [projectPaths];

    // Build projects map: name → project state
    this.projects = new Map();
    for (const p of paths) {
      const resolved = path.resolve(p);
      const name = path.basename(resolved);
      this.projects.set(name, {
        name,
        projectPath: resolved,
        hankDir: path.join(resolved, ".hank"),
        watcher: null,
        parentWatcher: null,
        debounceTimer: null,
        sseClients: new Set(),
      });
    }

    // Primary project (first one) — for backwards compatibility
    this._primaryName = [...this.projects.keys()][0];
  }

  /**
   * Backwards-compatible accessors for single-project usage and test overrides.
   */
  get projectPath() {
    return this.projects.get(this._primaryName).projectPath;
  }

  get hankDir() {
    return this.projects.get(this._primaryName).hankDir;
  }

  set hankDir(dir) {
    this.projects.get(this._primaryName).hankDir = dir;
  }

  get sseClients() {
    return this.projects.get(this._primaryName).sseClients;
  }

  get watcher() {
    return this.projects.get(this._primaryName).watcher;
  }

  set watcher(w) {
    this.projects.get(this._primaryName).watcher = w;
  }

  get parentWatcher() {
    return this.projects.get(this._primaryName).parentWatcher;
  }

  set parentWatcher(w) {
    this.projects.get(this._primaryName).parentWatcher = w;
  }

  get debounceTimer() {
    return this.projects.get(this._primaryName).debounceTimer;
  }

  set debounceTimer(t) {
    this.projects.get(this._primaryName).debounceTimer = t;
  }

  /**
   * Resolve a project by name. Returns the primary project if name is falsy.
   */
  _resolveProject(name) {
    if (!name) return this.projects.get(this._primaryName);
    if (this.projects.has(name)) return this.projects.get(name);
    return null;
  }

  /**
   * Read all Hank data files for a project and return unified dashboard state.
   */
  getData(projectName) {
    const proj = this._resolveProject(projectName);
    if (!proj) return null;
    return parseAll(proj.hankDir);
  }

  /**
   * Start watching .hank/ directory for a project.
   */
  startWatching(projectName) {
    const proj = this._resolveProject(projectName);
    if (!proj) return;

    if (!fs.existsSync(proj.hankDir)) {
      console.error(
        `Warning: ${proj.hankDir} does not exist yet. Watching for creation...`
      );
      proj.parentWatcher = fs.watch(proj.projectPath, (eventType, filename) => {
        if (filename === ".hank" && fs.existsSync(proj.hankDir)) {
          proj.parentWatcher.close();
          proj.parentWatcher = null;
          this._watchHankDir(proj);
        }
      });
      return;
    }
    this._watchHankDir(proj);
  }

  _watchHankDir(proj) {
    try {
      proj.watcher = fs.watch(proj.hankDir, { recursive: false }, () => {
        clearTimeout(proj.debounceTimer);
        proj.debounceTimer = setTimeout(
          () => this.broadcastUpdate(proj.name),
          300
        );
      });
    } catch (err) {
      console.error(`Error watching ${proj.hankDir}:`, err.message);
    }
  }

  /**
   * Broadcast current state to SSE clients subscribed to a project.
   */
  broadcastUpdate(projectName) {
    const proj = this._resolveProject(projectName);
    if (!proj) return;

    const data = parseAll(proj.hankDir);
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of proj.sseClients) {
      try {
        client.write(payload);
      } catch {
        proj.sseClients.delete(client);
      }
    }
  }

  /**
   * Handle incoming HTTP requests.
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);

    // API: list registered projects
    if (url.pathname === "/api/projects") {
      const list = [...this.projects.values()].map((p) => ({
        name: p.name,
        path: p.projectPath,
      }));
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      });
      res.end(JSON.stringify(list));
      return;
    }

    // API: dashboard data (optional ?project=name)
    if (url.pathname === "/api/data") {
      const projectName = url.searchParams.get("project");
      const data = this.getData(projectName);
      if (!data) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Project not found" }));
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      });
      res.end(JSON.stringify(data));
      return;
    }

    // SSE: real-time updates (optional ?project=name)
    if (url.pathname === "/api/events") {
      const projectName = url.searchParams.get("project");
      const proj = this._resolveProject(projectName);
      if (!proj) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Project not found" }));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const data = parseAll(proj.hankDir);
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      proj.sseClients.add(res);

      req.on("close", () => {
        proj.sseClients.delete(res);
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
   * Start the HTTP server and file watchers for all projects.
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
        const names = [...this.projects.keys()];
        console.log(`hank-dash running at http://localhost:${this.port}`);
        console.log(`Watching ${names.length} project(s): ${names.join(", ")}`);
        for (const [name] of this.projects) {
          this.startWatching(name);
        }
        resolve(this.server);
      });
    });
  }

  /**
   * Stop the server and all file watchers.
   */
  stop() {
    for (const proj of this.projects.values()) {
      if (proj.parentWatcher) {
        proj.parentWatcher.close();
        proj.parentWatcher = null;
      }
      if (proj.watcher) {
        proj.watcher.close();
        proj.watcher = null;
      }
      clearTimeout(proj.debounceTimer);
      for (const client of proj.sseClients) {
        client.end();
      }
      proj.sseClients.clear();
    }
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
