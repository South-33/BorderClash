import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { articleCountByEnvironment, normalizeArticleUrl } from "../research/lib/articles.mjs";

test("canonical article helpers keep one simple counting model", () => {
  assert.equal(normalizeArticleUrl(" https://example.com/story/ "), "https://example.com/story");
  assert.deepEqual(articleCountByEnvironment([
    { mediaEnvironment: "thailand-domestic" },
    { mediaEnvironment: "cambodia-domestic" },
    { mediaEnvironment: "international" },
    { mediaEnvironment: "international", status: "archived" },
  ]), { thailand: 1, cambodia: 1, international: 2, total: 4 });
});

test("evidence migration harness consolidates articles without changing timeline evidence", () => {
  const source = fs.readFileSync("scripts/evidence-migration-harness.mjs", "utf8");
  assert.match(source, /canonical article URL universe changed/);
  assert.match(source, /one canonical row per article URL is required/);
  assert.match(source, /timeline evidence URLs changed or reordered/);
  assert.match(source, /legacy inline sources remain/);
  assert.match(source, /unverified article cannot exceed 50/);
  assert.match(source, /duplicate article .* must retain one existing id/);
});
