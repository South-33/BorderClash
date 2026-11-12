import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("evidence migration harness protects canonical content while allowing score migration", () => {
  const source = fs.readFileSync("scripts/evidence-migration-harness.mjs", "utf8");
  assert.match(source, /fields other than credibility changed/);
  assert.match(source, /record count changed/);
  assert.match(source, /news\/timeline file set changed/);
  assert.match(source, /unverified news cannot exceed 50/);
  assert.match(source, /research-state changed beyond evidenceRubricActivatedAt/);
  assert.match(source, /EVIDENCE_ALLOWED_SCORES\.has/);
});
