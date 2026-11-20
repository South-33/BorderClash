import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deletedTimelineRecordFromGit } from "../research/lib/audit-packet-loader.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "borderclash-deletion-packet-"));
  const timelineDir = join(root, "data", "timeline");
  mkdirSync(timelineDir, { recursive: true });
  writeFileSync(
    join(timelineDir, "2025-12.jsonl"),
    [
      JSON.stringify({ id: "keep", date: "2025-12-13", title: "Keep" }),
      JSON.stringify({ id: "delete-me", date: "2025-12-14", timeOfDay: "09:20", title: "Delete", evidenceIds: ["article-1"] }),
    ].join("\n") + "\n",
    "utf8",
  );
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "audit@example.test"]);
  git(root, ["config", "user.name", "Audit Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "base"]);
  return root;
}

function stageDeletion(root) {
  writeFileSync(
    join(root, "data", "timeline", "2025-12.jsonl"),
    JSON.stringify({ id: "keep", date: "2025-12-13", title: "Keep" }) + "\n",
    "utf8",
  );
  git(root, ["add", "data/timeline/2025-12.jsonl"]);
}

test("deletion packet loader recovers the baseline row from a staged timeline deletion", () => {
  const root = makeRepo();
  stageDeletion(root);

  assert.deepEqual(deletedTimelineRecordFromGit("delete-me", { cwd: root }), {
    id: "delete-me",
    date: "2025-12-14",
    timeOfDay: "09:20",
    title: "Delete",
    evidenceIds: ["article-1"],
  });
  assert.equal(deletedTimelineRecordFromGit("missing", { cwd: root }), null);
});

test("deletion packet loader recovers the same baseline row after the deletion is committed", () => {
  const root = makeRepo();
  stageDeletion(root);
  const staged = deletedTimelineRecordFromGit("delete-me", { cwd: root });
  git(root, ["commit", "-qm", "delete row"]);

  assert.deepEqual(deletedTimelineRecordFromGit("delete-me", { cwd: root }), staged);
});

test("deletion packet loader remains resumable after later timeline commits", () => {
  const root = makeRepo();
  stageDeletion(root);
  const staged = deletedTimelineRecordFromGit("delete-me", { cwd: root });
  git(root, ["commit", "-qm", "delete row"]);
  writeFileSync(
    join(root, "data", "timeline", "2025-12.jsonl"),
    [
      JSON.stringify({ id: "keep", date: "2025-12-13", title: "Keep" }),
      JSON.stringify({ id: "later", date: "2025-12-15", title: "Later" }),
    ].join("\n") + "\n",
    "utf8",
  );
  git(root, ["add", "data/timeline/2025-12.jsonl"]);
  git(root, ["commit", "-qm", "later timeline change"]);

  assert.deepEqual(deletedTimelineRecordFromGit("delete-me", { cwd: root }), staged);
});
