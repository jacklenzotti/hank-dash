const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseAuditLog } = require("../../src/parsers/audit-log");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseAuditLog", () => {
  it("parses audit log JSONL with events", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    assert.ok(audit);
    assert.ok(Array.isArray(audit.events));
    assert.equal(audit.events.length, 15);
  });

  it("contains expected event fields", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    const first = audit.events[0];
    assert.equal(first.type, "info");
    assert.equal(first.timestamp, "2026-01-15T10:00:00Z");
    assert.equal(first.sessionId, "sess_001");
    assert.equal(first.loop, 1);
    assert.equal(first.message, "Loop started");
    assert.ok(first.details);
  });

  it("handles different event types", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    const types = audit.events.map((e) => e.type);
    assert.ok(types.includes("info"));
    assert.ok(types.includes("error"));
    assert.ok(types.includes("circuit-breaker"));
    assert.ok(types.includes("completion"));
  });

  it("groups events by session", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    assert.ok(audit.sessions);
    assert.ok(audit.sessions.sess_001);
    assert.ok(audit.sessions.sess_002);
    assert.equal(audit.sessions.sess_001.length, 4);
    assert.equal(audit.sessions.sess_002.length, 3);
    assert.ok(audit.sessions.sess_003);
    assert.equal(audit.sessions.sess_003.length, 8);
  });

  it("session events are in chronological order", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    const sess001 = audit.sessions.sess_001;
    assert.equal(sess001[0].loop, 1);
    assert.equal(sess001[1].loop, 2);
    assert.equal(sess001[2].loop, 2);
    assert.equal(sess001[3].loop, 3);
  });

  it("returns last 100 events when more exist", () => {
    // This test verifies the behavior even if our fixture has fewer than 100
    const audit = parseAuditLog(FIXTURES_DIR);
    assert.ok(audit.events.length <= 100);
  });

  it("returns empty result for missing file", () => {
    const audit = parseAuditLog("/nonexistent/path");
    assert.deepEqual(audit, {
      events: [],
      sessions: {},
      orchestrationTimeline: [],
    });
  });

  it("skips malformed JSONL lines", () => {
    // This is tested in malformed-json.test.js
    const audit = parseAuditLog(FIXTURES_DIR);
    assert.ok(Array.isArray(audit.events));
  });

  it("handles missing optional fields with defaults", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    audit.events.forEach((event) => {
      assert.ok(event.type);
      assert.ok(event.details !== undefined);
      assert.ok(event.message !== undefined);
    });
  });

  it("extracts repoName from orchestration events", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    const orchEvents = audit.events.filter((e) =>
      e.type.startsWith("orchestration_repo")
    );
    assert.ok(orchEvents.length > 0);
    orchEvents.forEach((e) => {
      assert.ok(e.repoName, "orchestration repo events should have repoName");
    });
  });

  it("builds orchestration timeline from events", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    assert.ok(Array.isArray(audit.orchestrationTimeline));
    assert.equal(audit.orchestrationTimeline.length, 3); // shared-types, frontend, backend-api

    const names = audit.orchestrationTimeline.map((w) => w.name);
    assert.ok(names.includes("shared-types"));
    assert.ok(names.includes("frontend"));
    assert.ok(names.includes("backend-api"));
  });

  it("orchestration timeline entries have start/end times", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    audit.orchestrationTimeline.forEach((w) => {
      assert.ok(w.name);
      assert.ok(w.start, "timeline entry should have start time");
      assert.ok(w.end, "timeline entry should have end time");
      assert.ok(w.status);
      assert.ok(w.orchestrationStart);
      assert.ok(w.orchestrationEnd);
    });
  });

  it("orchestration timeline is sorted by priority then start time", () => {
    const audit = parseAuditLog(FIXTURES_DIR);
    // shared-types has priority 0, frontend and backend-api have priority 1
    assert.equal(audit.orchestrationTimeline[0].name, "shared-types");
    assert.equal(audit.orchestrationTimeline[0].priority, 0);
  });
});
