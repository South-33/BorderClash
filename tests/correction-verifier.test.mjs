import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyNewsArticleMoves,
  diffRecords,
  stableArticleId,
} from "../research/automation/verify-correction.mjs";

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

test("correction verifier treats a stable article ID moved between monthly files as a move", () => {
  const result = classifyNewsArticleMoves([
    {
      path: "data/news/2025-12.jsonl",
      added: [{ id: "legacy-id", sourceUrl: "https://www.example.com/report/?utm_source=a", publishedAt: 1 }],
      deleted: [],
    },
    {
      path: "data/news/2026-01.jsonl",
      added: [],
      deleted: [{ id: "legacy-id", sourceUrl: "https://example.com/report", publishedAt: 2 }],
    },
  ]);

  assert.deepEqual(result.addedArticles, []);
  assert.deepEqual(result.movedArticles, [{
    articleId: "legacy-id",
    fromPath: "data/news/2026-01.jsonl",
    toPath: "data/news/2025-12.jsonl",
    sourceUrl: "https://www.example.com/report/?utm_source=a",
    contentChanged: true,
  }]);
});

test("correction verifier rejects a cross-file stable ID move that changes article identity", () => {
  assert.throws(() => classifyNewsArticleMoves([
    {
      path: "data/news/2025-12.jsonl",
      added: [{ id: "legacy-id", sourceUrl: "https://example.com/new" }],
      deleted: [],
    },
    {
      path: "data/news/2026-01.jsonl",
      added: [],
      deleted: [{ id: "legacy-id", sourceUrl: "https://example.com/old" }],
    },
  ]), /changed canonical source URL/u);
});

test("correction verifier is snapshot-stable and checks evidence references", () => {
  const source = readFileSync("research/automation/verify-correction.mjs", "utf8");
  assert.match(source, /worktreeFingerprint/u);
  assert.match(source, /verifyArchiveCopy/u);
  assert.match(source, /checkReferenceCoverage/u);
  assert.match(source, /missingTimelineEvidenceIds/u);
  assert.match(source, /missingCurrentEvidenceIds/u);
  assert.match(source, /git.+diff.+--check/su);
  assert.match(source, /data\/current\//u);
  assert.match(source, /data\/research-state\.json/u);
  assert.match(source, /diffJsonDocument/u);
  assert.match(source, /Another next build process is already running/u);
  assert.match(source, /retryConcurrentBuild/u);
});
