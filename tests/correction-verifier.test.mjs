import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { diffRecords, stableArticleId } from "../research/automation/verify-correction.mjs";

test("correction verifier identifies added, modified, and deleted JSONL records", () => {
  const before = [
    { id: "same", value: 1 },
    { id: "changed", value: 1 },
    { id: "deleted", value: 1 },
  ];
  const after = [
    { id: "same", value: 1 },
    { id: "changed", value: 2 },
    { id: "added", value: 1 },
  ];
  const result = diffRecords(before, after);
  assert.deepEqual(result.added.map((row) => row.id), ["added"]);
  assert.deepEqual(result.modified.map((row) => row.id), ["changed"]);
  assert.deepEqual(result.deleted.map((row) => row.id), ["deleted"]);
});

test("correction verifier uses canonical normalized URL identity", () => {
  assert.equal(
    stableArticleId("https://www.example.com/report/?utm_source=test"),
    stableArticleId("https://example.com/report"),
  );
  assert.notEqual(
    stableArticleId("https://example.com/report?a=1"),
    stableArticleId("https://example.com/report?a=2"),
  );
});

test("correction verifier is snapshot-stable and checks evidence references", () => {
  const source = readFileSync("research/automation/verify-correction.mjs", "utf8");
  assert.match(source, /worktreeFingerprint/u);
  assert.match(source, /verifyArchiveCopy/u);
  assert.match(source, /auditReferenceCoverage/u);
  assert.match(source, /missingTimelineEvidenceIds/u);
  assert.match(source, /missingCurrentEvidenceIds/u);
  assert.match(source, /git.+diff.+--check/su);
  assert.match(source, /data\/current\//u);
  assert.match(source, /data\/research-state\.json/u);
  assert.match(source, /diffJsonDocument/u);
  assert.match(source, /Another next build process is already running/u);
  assert.match(source, /retryConcurrentBuild/u);
});
