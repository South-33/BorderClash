import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditPreflight } from "../research/automation/preflight-audit-correction.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "borderclash-audit-preflight-"));
  mkdirSync(join(root, "research"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "data", "news"), { recursive: true });
  writeFileSync(join(root, "research", "validate.mjs"), "process.exit(0);\n", "utf8");
  writeFileSync(join(root, "data", "sample.jsonl"), '{"id":"base"}\n', "utf8");
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "audit@example.test"]);
  git(root, ["config", "user.name", "Audit Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "base"]);
  return root;
}

function articleId(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

test("audit preflight checks staged data for whitespace before expensive verification", () => {
  const root = makeRepo();
  writeFileSync(join(root, "data", "sample.jsonl"), '{"id":"changed"}\n\n', "utf8");
  git(root, ["add", "data/sample.jsonl"]);

  const result = auditPreflight({ cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "staged-diff-check-failed");
  assert.match(result.output, /new blank line at EOF/u);
});

test("audit preflight validates staged audit data", () => {
  const root = makeRepo();
  writeFileSync(join(root, "data", "sample.jsonl"), '{"id":"changed"}\n', "utf8");
  git(root, ["add", "data/sample.jsonl"]);

  const result = auditPreflight({ cwd: root });
  assert.equal(result.ok, true);
  assert.ok(result.validateMs >= 0);
});

test("audit preflight refuses to verify when relevant audit work is not staged", () => {
  const root = makeRepo();
  writeFileSync(join(root, "data", "sample.jsonl"), '{"id":"unstaged"}\n', "utf8");
  writeFileSync(join(root, "README.md"), "staged\n", "utf8");
  git(root, ["add", "README.md"]);

  const result = auditPreflight({ cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "audit-files-not-staged");
  assert.deepEqual(result.unstagedRelevant, ["data/sample.jsonl"]);
});

test("audit preflight rejects a newly added news row before review when its URL identity is wrong", () => {
  const root = makeRepo();
  const sourceUrl = "https://example.com/report";
  const path = join(root, "data", "news", "2026-04.jsonl");
  writeFileSync(path, JSON.stringify({
    id: "f10f5fb00ae9dfab3073198a1d266fc6",
    sourceUrl,
    source: "Example",
  }) + "\n", "utf8");
  git(root, ["add", "data/news/2026-04.jsonl"]);

  const result = auditPreflight({ cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "noncanonical-new-article-id");
  assert.deepEqual(result.articleIdentityIssues, [{
    path: "data/news/2026-04.jsonl",
    articleId: "f10f5fb00ae9dfab3073198a1d266fc6",
    expectedId: articleId(sourceUrl),
    sourceUrl,
  }]);
});

test("audit preflight accepts a newly added news row with its canonical URL-derived ID", () => {
  const root = makeRepo();
  const sourceUrl = "https://example.com/report";
  const path = join(root, "data", "news", "2026-04.jsonl");
  writeFileSync(path, JSON.stringify({
    id: articleId(sourceUrl),
    sourceUrl,
    source: "Example",
  }) + "\n", "utf8");
  git(root, ["add", "data/news/2026-04.jsonl"]);

  const result = auditPreflight({ cwd: root });
  assert.equal(result.ok, true);
});
