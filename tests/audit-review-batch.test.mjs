import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertBatchPromptSize,
  buildBatchReviewPrompt,
  buildBatchReviewSchema,
  normalizeBatchRecordIds,
  validateBatchReviewOutput,
} from "../research/lib/audit-review-batch.mjs";

const sampleReview = (recordId, verdict = "no_change") => ({
  recordId,
  verdict,
  supportedEventDate: null,
  supportedEventTime: null,
  claimsSupported: true,
  issues: [],
  rationale: "Captured publisher text supports the stored news record.",
});

test("news audit batches stay inside the verified four-record envelope", () => {
  assert.deepEqual(normalizeBatchRecordIds(["a", "b"]), ["a", "b"]);
  assert.throws(() => normalizeBatchRecordIds(["a"]), /at least 2/u);
  assert.throws(() => normalizeBatchRecordIds(["a", "a"]), /unique/u);
  assert.equal(normalizeBatchRecordIds(["a", "b", "c", "d"]).length, 4);
  assert.throws(() => normalizeBatchRecordIds(["a", "b", "c", "d", "e"]), /at most 4/u);
});

test("batch schema requires one review per requested record", () => {
  const schema = buildBatchReviewSchema(["a", "b", "c"]);
  assert.equal(schema.properties.reviews.minItems, 3);
  assert.equal(schema.properties.reviews.maxItems, 3);
  assert.deepEqual(schema.properties.reviews.items.properties.verdict.enum, ["no_change", "change", "unresolved"]);
});

test("batch output must contain the exact requested id set", () => {
  const result = validateBatchReviewOutput({ reviews: [sampleReview("b"), sampleReview("a")] }, ["a", "b"]);
  assert.equal(result.get("a").recordId, "a");
  assert.throws(
    () => validateBatchReviewOutput({ reviews: [sampleReview("a"), sampleReview("a")] }, ["a", "b"]),
    /duplicate/u,
  );
  assert.throws(
    () => validateBatchReviewOutput({ reviews: [sampleReview("a"), sampleReview("c")] }, ["a", "b"]),
    /unexpected/u,
  );
});

test("batch prompt isolates records and forbids cross-record inference", () => {
  const prompt = buildBatchReviewPrompt({
    guide: "rules",
    entries: [
      { recordId: "a", packetText: "{\"id\":\"a\"}", capturedText: "publisher A" },
      { recordId: "b", packetText: "{\"id\":\"b\"}", capturedText: "publisher B" },
    ],
  });
  assert.match(prompt, /Assess each record independently/u);
  assert.match(prompt, /Do not use one record as evidence for another/u);
  assert.match(prompt, /id="a"/u);
  assert.match(prompt, /id="b"/u);
});

test("batch prompt size is bounded independently of record count", () => {
  assert.equal(assertBatchPromptSize("x".repeat(20), 20), 20);
  assert.throws(() => assertBatchPromptSize("x".repeat(21), 20), /split the batch/u);
});

test("batch runner preserves the single-review safety envelope", () => {
  const nodeRunner = readFileSync("research/automation/run-news-audit-batch.mjs", "utf8");
  const psRunner = readFileSync("research/automation/run-news-audit-batch.ps1", "utf8");
  for (const denied of ["command(*)", "read_file(*)", "write_file(*)", "read_url(*)", "execute_url(*)", "download_url(*)", "mcp(*)"]) {
    assert.match(nodeRunner, new RegExp(denied.replace(/[()*]/gu, "\\$&"), "u"));
  }
  assert.match(nodeRunner, /packetSha256/u);
  assert.match(nodeRunner, /capturedEvidenceSha256/u);
  assert.match(nodeRunner, /AUDIT_PACKET\.\$\{safeId\}\.json/u);
  assert.match(nodeRunner, /CAPTURED_EVIDENCE\.\$\{safeId\}\.json/u);
  assert.match(nodeRunner, /drifted/u);
  assert.match(nodeRunner, /precheck: false/u);
  assert.match(nodeRunner, /packet\.kind !== "news"/u);
  assert.match(psRunner, /BorderClashAuditReviewSlot-/u);
  assert.match(psRunner, /BorderClashAuditReview-/u);
  assert.match(psRunner, /WaitOne\(0\)/u);
});
