const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { parseErrorCatalog } = require("../../src/parsers/error-catalog");

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

describe("parseErrorCatalog", () => {
  it("parses error catalog with multiple errors", () => {
    const errors = parseErrorCatalog(FIXTURES_DIR);
    assert.ok(Array.isArray(errors));
    assert.equal(errors.length, 3);
  });

  it("contains expected error fields", () => {
    const errors = parseErrorCatalog(FIXTURES_DIR);
    const first = errors[0];
    assert.equal(first.category, "persistent");
    assert.equal(first.signature, "ENOENT: /path/to/file");
    assert.equal(first.count, 5);
    assert.equal(first.firstSeen, "2026-01-15T10:30:00Z");
    assert.equal(first.lastSeen, "2026-01-15T14:45:00Z");
    assert.ok(first.sampleMessage.includes("ENOENT"));
  });

  it("handles different error categories", () => {
    const errors = parseErrorCatalog(FIXTURES_DIR);
    const categories = errors.map((e) => e.category);
    assert.ok(categories.includes("persistent"));
    assert.ok(categories.includes("transient"));
    assert.ok(categories.includes("resolved"));
  });

  it("returns empty array for missing file", () => {
    const errors = parseErrorCatalog("/nonexistent/path");
    assert.deepEqual(errors, []);
  });

  it("handles missing category field with default", () => {
    const errors = parseErrorCatalog(FIXTURES_DIR);
    errors.forEach((err) => {
      assert.ok(err.category);
    });
  });

  it("handles missing count field with default", () => {
    const errors = parseErrorCatalog(FIXTURES_DIR);
    errors.forEach((err) => {
      assert.equal(typeof err.count, "number");
    });
  });
});
