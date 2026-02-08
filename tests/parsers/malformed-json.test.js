/**
 * Tests that parsers gracefully handle malformed JSON instead of crashing.
 * Hank writes files atomically, but partial writes or corruption can happen.
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { parseCostLog } = require("../../src/parsers/cost-log");
const { parseCostSession } = require("../../src/parsers/cost-session");
const {
  parseCircuitBreakerState,
  parseCircuitBreakerHistory,
} = require("../../src/parsers/circuit-breaker");
const {
  parseResponseAnalysis,
} = require("../../src/parsers/response-analysis");
const { parseExitSignals } = require("../../src/parsers/exit-signals");
const { parseStatus } = require("../../src/parsers/status");
const { parseProgress } = require("../../src/parsers/progress");
const { parseErrorCatalog } = require("../../src/parsers/error-catalog");
const { parseRetryLog } = require("../../src/parsers/retry-log");
const { parseOrchestration } = require("../../src/parsers/orchestration");
const { parseAuditLog } = require("../../src/parsers/audit-log");

let tmpDir;

describe("malformed JSON resilience", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hank-dash-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parseCostLog skips malformed JSONL lines", () => {
    fs.writeFileSync(
      path.join(tmpDir, "cost_log.jsonl"),
      '{"loop":1,"cost_usd":0.01,"input_tokens":100,"output_tokens":50}\n' +
        "{broken json\n" +
        '{"loop":3,"cost_usd":0.03,"input_tokens":300,"output_tokens":150}\n'
    );
    const entries = parseCostLog(tmpDir);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].loop, 1);
    assert.equal(entries[1].loop, 3);
  });

  it("parseCostSession returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".cost_session"), "{broken");
    const result = parseCostSession(tmpDir);
    assert.equal(result, null);
  });

  it("parseCircuitBreakerState returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".circuit_breaker_state"), "not json");
    const result = parseCircuitBreakerState(tmpDir);
    assert.equal(result, null);
  });

  it("parseCircuitBreakerHistory returns [] for malformed JSON", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".circuit_breaker_history"),
      "[{broken}"
    );
    const result = parseCircuitBreakerHistory(tmpDir);
    assert.deepEqual(result, []);
  });

  it("parseResponseAnalysis returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".response_analysis"), '{"confidence":');
    const result = parseResponseAnalysis(tmpDir);
    assert.equal(result, null);
  });

  it("parseExitSignals returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".exit_signals"), "");
    const result = parseExitSignals(tmpDir);
    assert.equal(result, null);
  });

  it("parseStatus returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "status.json"), "{truncated");
    const result = parseStatus(tmpDir);
    assert.equal(result, null);
  });

  it("parseProgress returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "progress.json"), "{{double brace");
    const result = parseProgress(tmpDir);
    assert.equal(result, null);
  });

  it("parseErrorCatalog returns [] for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".error_catalog"), "{broken json");
    const result = parseErrorCatalog(tmpDir);
    assert.deepEqual(result, []);
  });

  it("parseErrorCatalog returns [] for missing errors array", () => {
    fs.writeFileSync(path.join(tmpDir, ".error_catalog"), '{"not_errors": []}');
    const result = parseErrorCatalog(tmpDir);
    assert.deepEqual(result, []);
  });

  it("parseRetryLog skips malformed JSONL lines", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".retry_log"),
      '{"timestamp":"2026-01-15T10:00:00Z","strategy":"backoff","outcome":"success","attempt_number":1}\n' +
        "{malformed\n" +
        '{"timestamp":"2026-01-15T10:05:00Z","strategy":"constant","outcome":"failure","attempt_number":2}\n'
    );
    const entries = parseRetryLog(tmpDir);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].strategy, "backoff");
    assert.equal(entries[1].strategy, "constant");
  });

  it("parseOrchestration returns null for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".orchestration_state"), "{broken json");
    const result = parseOrchestration(tmpDir);
    assert.equal(result, null);
  });

  it("parseOrchestration returns null for missing repos array", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".orchestration_state"),
      '{"not_repos": []}'
    );
    const result = parseOrchestration(tmpDir);
    assert.equal(result, null);
  });

  it("parseAuditLog skips malformed JSONL lines", () => {
    fs.writeFileSync(
      path.join(tmpDir, "audit_log.jsonl"),
      '{"type":"info","timestamp":"2026-01-15T10:00:00Z","session_id":"sess_001","message":"valid"}\n' +
        "{malformed line\n" +
        '{"type":"error","timestamp":"2026-01-15T10:05:00Z","session_id":"sess_001","message":"also valid"}\n'
    );
    const result = parseAuditLog(tmpDir);
    assert.equal(result.events.length, 2);
    assert.equal(result.events[0].type, "info");
    assert.equal(result.events[1].type, "error");
  });

  it("parseAuditLog returns empty result for empty file", () => {
    fs.writeFileSync(path.join(tmpDir, "audit_log.jsonl"), "");
    const result = parseAuditLog(tmpDir);
    assert.deepEqual(result, {
      events: [],
      sessions: {},
      orchestrationTimeline: [],
    });
  });
});
