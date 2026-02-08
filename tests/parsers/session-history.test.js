const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { parseSessionHistory } = require("../../src/parsers/session-history");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseSessionHistory", () => {
  describe("legacy format (session summary objects)", () => {
    it("parses session history array", () => {
      const sessions = parseSessionHistory(FIXTURES_DIR);
      assert.ok(Array.isArray(sessions));
      assert.equal(sessions.length, 2);
    });

    it("contains expected session fields", () => {
      const sessions = parseSessionHistory(FIXTURES_DIR);
      const first = sessions[0];
      assert.equal(first.session_id, "sess_001");
      assert.equal(first.loops, 5);
      assert.equal(first.total_cost_usd, 0.45);
      assert.equal(first.total_duration_seconds, 300);
      assert.equal(first.exit_reason, "all_tests_passing");
    });

    it("returns empty array for missing file", () => {
      const sessions = parseSessionHistory("/nonexistent/path");
      assert.deepEqual(sessions, []);
    });
  });

  describe("state-transition format (Hank actual output)", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hank-session-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("aggregates transitions into a single completed session", () => {
      const transitions = JSON.parse(
        fs.readFileSync(
          path.join(FIXTURES_DIR, "hank_session_history_transitions.json"),
          "utf-8"
        )
      );
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      assert.ok(Array.isArray(sessions));
      assert.equal(sessions.length, 1);
    });

    it("extracts started_at from session_start transition", () => {
      const transitions = JSON.parse(
        fs.readFileSync(
          path.join(FIXTURES_DIR, "hank_session_history_transitions.json"),
          "utf-8"
        )
      );
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      assert.equal(sessions[0].started_at, "2026-02-08T06:18:50+00:00");
    });

    it("counts loops from loop_completed transitions", () => {
      const transitions = JSON.parse(
        fs.readFileSync(
          path.join(FIXTURES_DIR, "hank_session_history_transitions.json"),
          "utf-8"
        )
      );
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      // Last loop_completed has loop_number: 5 (the terminal transition)
      // But the last loop_completed before terminal is loop_number: 4
      // The terminal transition (project_complete) has loop_number: 5
      // which is a loop_completed? No, reason is "project_complete"
      // So loops counted: loop_number 1, 2, 3, 4 from loop_completed entries
      assert.equal(sessions[0].loops, 4);
    });

    it("extracts exit_reason from terminal transition", () => {
      const transitions = JSON.parse(
        fs.readFileSync(
          path.join(FIXTURES_DIR, "hank_session_history_transitions.json"),
          "utf-8"
        )
      );
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      assert.equal(sessions[0].exit_reason, "project_complete");
    });

    it("calculates duration from timestamps", () => {
      const transitions = JSON.parse(
        fs.readFileSync(
          path.join(FIXTURES_DIR, "hank_session_history_transitions.json"),
          "utf-8"
        )
      );
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      assert.ok(sessions[0].total_duration_seconds > 0);
      // From 06:18:50 to 06:41:02 = 22 min 12 sec = 1332 seconds
      assert.equal(sessions[0].total_duration_seconds, 1332);
    });

    it("handles multiple sessions in one file", () => {
      const transitions = [
        {
          timestamp: "2026-02-07T10:00:00Z",
          from_state: "none",
          to_state: "active",
          reason: "session_start",
          loop_number: 0,
        },
        {
          timestamp: "2026-02-07T10:05:00Z",
          from_state: "active",
          to_state: "active",
          reason: "loop_completed",
          loop_number: 1,
        },
        {
          timestamp: "2026-02-07T10:10:00Z",
          from_state: "active",
          to_state: "reset",
          reason: "circuit_breaker_open",
          loop_number: 1,
        },
        {
          timestamp: "2026-02-08T06:00:00Z",
          from_state: "none",
          to_state: "active",
          reason: "session_start",
          loop_number: 0,
        },
        {
          timestamp: "2026-02-08T06:15:00Z",
          from_state: "active",
          to_state: "active",
          reason: "loop_completed",
          loop_number: 1,
        },
        {
          timestamp: "2026-02-08T06:30:00Z",
          from_state: "active",
          to_state: "active",
          reason: "loop_completed",
          loop_number: 2,
        },
        {
          timestamp: "2026-02-08T06:45:00Z",
          from_state: "active",
          to_state: "reset",
          reason: "project_complete",
          loop_number: 3,
        },
      ];
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      assert.equal(sessions.length, 2);
      assert.equal(sessions[0].exit_reason, "circuit_breaker_open");
      assert.equal(sessions[0].loops, 1);
      assert.equal(sessions[1].exit_reason, "project_complete");
      assert.equal(sessions[1].loops, 2);
    });

    it("marks in-progress session when no terminal state", () => {
      const transitions = [
        {
          timestamp: "2026-02-08T10:00:00Z",
          from_state: "none",
          to_state: "active",
          reason: "session_start",
          loop_number: 0,
        },
        {
          timestamp: "2026-02-08T10:05:00Z",
          from_state: "active",
          to_state: "active",
          reason: "loop_completed",
          loop_number: 1,
        },
        {
          timestamp: "2026-02-08T10:10:00Z",
          from_state: "active",
          to_state: "active",
          reason: "loop_completed",
          loop_number: 2,
        },
      ];
      fs.writeFileSync(
        path.join(tmpDir, ".hank_session_history"),
        JSON.stringify(transitions)
      );

      const sessions = parseSessionHistory(tmpDir);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].exit_reason, "in_progress");
      assert.equal(sessions[0].loops, 2);
    });
  });
});
