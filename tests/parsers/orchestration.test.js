const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseOrchestration } = require("../../src/parsers/orchestration");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseOrchestration", () => {
  it("parses orchestration state with repo list", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    assert.ok(orch);
    assert.ok(Array.isArray(orch.repos));
    assert.equal(orch.repos.length, 5);
  });

  it("contains expected orchestration summary fields", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    assert.equal(orch.totalRepos, 5);
    assert.equal(orch.completedRepos, 2);
    assert.equal(orch.inProgressRepos, 1);
    assert.equal(orch.blockedRepos, 1);
  });

  it("contains expected repo fields", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    const frontend = orch.repos.find((r) => r.name === "frontend");
    assert.ok(frontend);
    assert.equal(frontend.status, "completed");
    assert.equal(frontend.loops, 8);
    assert.equal(frontend.cost, 0.52);
    assert.deepEqual(frontend.dependencies, []);
    assert.deepEqual(frontend.blockedBy, []);
  });

  it("handles repos with dependencies", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    const backend = orch.repos.find((r) => r.name === "backend-api");
    assert.ok(backend);
    assert.deepEqual(backend.dependencies, ["shared-types"]);
  });

  it("handles blocked repos", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    const migrations = orch.repos.find((r) => r.name === "database-migrations");
    assert.ok(migrations);
    assert.equal(migrations.status, "blocked");
    assert.deepEqual(migrations.blockedBy, ["backend-api"]);
  });

  it("handles different repo statuses", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    const statuses = orch.repos.map((r) => r.status);
    assert.ok(statuses.includes("completed"));
    assert.ok(statuses.includes("in_progress"));
    assert.ok(statuses.includes("blocked"));
    assert.ok(statuses.includes("pending"));
  });

  it("returns null for missing file", () => {
    const orch = parseOrchestration("/nonexistent/path");
    assert.equal(orch, null);
  });

  it("handles missing optional fields with defaults", () => {
    const orch = parseOrchestration(FIXTURES_DIR);
    orch.repos.forEach((repo) => {
      assert.ok(repo.name);
      assert.ok(repo.status);
      assert.equal(typeof repo.loops, "number");
      assert.equal(typeof repo.cost, "number");
      assert.ok(Array.isArray(repo.dependencies));
      assert.ok(Array.isArray(repo.blockedBy));
    });
  });
});
