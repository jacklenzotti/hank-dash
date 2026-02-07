const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  parseImplementationPlan,
} = require("../../src/parsers/implementation-plan");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseImplementationPlan", () => {
  it("parses tasks from markdown checkboxes", () => {
    const plan = parseImplementationPlan(FIXTURES_DIR);
    assert.equal(plan.totalCount, 5);
    assert.equal(plan.completedCount, 2);
  });

  it("correctly identifies completed tasks", () => {
    const plan = parseImplementationPlan(FIXTURES_DIR);
    assert.equal(plan.tasks[0].completed, true);
    assert.equal(plan.tasks[0].text, "Set up project scaffold");
    assert.equal(plan.tasks[2].completed, false);
    assert.equal(plan.tasks[2].text, "Build HTTP server with SSE");
  });

  it("returns empty for missing file", () => {
    const plan = parseImplementationPlan("/nonexistent/path");
    assert.equal(plan.totalCount, 0);
    assert.deepEqual(plan.tasks, []);
  });
});
