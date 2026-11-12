import assert from "node:assert/strict";
import test from "node:test";
import {
  EVIDENCE_ALLOWED_SCORES,
  EVIDENCE_RUBRIC_VERSION,
  evidenceRubricPrompt,
  isEvidenceScore,
} from "../research/lib/evidence-score.mjs";

test("evidence-v2 exposes one exact decile scale from false to verified", () => {
  assert.equal(EVIDENCE_RUBRIC_VERSION, "evidence-v2");
  assert.deepEqual([...EVIDENCE_ALLOWED_SCORES].sort((a, b) => a - b), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.equal(isEvidenceScore(0), true);
  assert.equal(isEvidenceScore(50), true);
  assert.equal(isEvidenceScore(100), true);
  assert.equal(isEvidenceScore(55), false);
  assert.equal(isEvidenceScore(75), false);
});

test("research prompt contains the decisive anti-bias and anti-fake-precision rules", () => {
  const prompt = evidenceRubricPrompt();
  assert.match(prompt, /100 verified/);
  assert.match(prompt, /50 uncertain/);
  assert.match(prompt, /0 false\/fabricated/);
  assert.match(prompt, /claim, not the outlet/);
  assert.match(prompt, /cap at 60/);
  assert.match(prompt, /one evidence chain/);
  assert.match(prompt, /0\/10 require credible contrary evidence/);
});
