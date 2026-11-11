import assert from "node:assert/strict";
import test from "node:test";
import { EVIDENCE_ALLOWED_SCORES, normalizeEvidenceScore } from "../research/lib/evidence-score.mjs";

test("legacy evidence scores collapse to four public grades", () => {
  assert.equal(normalizeEvidenceScore(100), 90);
  assert.equal(normalizeEvidenceScore(85), 90);
  assert.equal(normalizeEvidenceScore(84), 75);
  assert.equal(normalizeEvidenceScore(70), 75);
  assert.equal(normalizeEvidenceScore(69), 55);
  assert.equal(normalizeEvidenceScore(45), 55);
  assert.equal(normalizeEvidenceScore(44), 30);
  assert.equal(normalizeEvidenceScore(90, "unverified"), 30);
  assert.deepEqual([...EVIDENCE_ALLOWED_SCORES].sort((a, b) => a - b), [30, 55, 75, 90]);
});
