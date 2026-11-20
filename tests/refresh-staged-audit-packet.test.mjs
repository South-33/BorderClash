import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { refreshStagedAuditPacketPlan } from "../research/automation/refresh-staged-audit-packet.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "borderclash-refresh-packet-"));
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "audit-test@example.invalid");
  git(root, "config", "user.name", "Audit Test");
  mkdirSync(join(root, "data", "news"), { recursive: true });
  mkdirSync(join(root, "data", "timeline"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  writeFileSync(
    join(root, "data", "news", "2026-02.jsonl"),
    '{"id":"evidence","value":1}\n{"id":"other-news","value":1}\n',
  );
  writeFileSync(
    join(root, "data", "timeline", "2026-02.jsonl"),
    '{"id":"claim","value":1}\n{"id":"other-timeline","value":1}\n',
  );
  git(root, "add", ".");
  git(root, "commit", "-m", "base");

  const source = join(root, "source");
  const target = join(root, "target");
  git(root, "worktree", "add", "-b", "source", source);
  git(root, "worktree", "add", "-b", "target", target);
  mkdirSync(join(source, "tests"), { recursive: true });

  writeFileSync(
    join(source, "data", "news", "2026-02.jsonl"),
    '{"id":"evidence","value":2}\n{"id":"other-news","value":1}\n',
  );
  writeFileSync(
    join(source, "data", "timeline", "2026-02.jsonl"),
    '{"id":"other-timeline","value":1}\n',
  );
  writeFileSync(join(source, "tests", "claim-audit-corrections.test.mjs"), "export default true;\n");
  git(source, "add", ".");

  writeFileSync(
    join(target, "data", "news", "2026-02.jsonl"),
    '{"id":"evidence","value":1}\n{"id":"other-news","value":9}\n',
  );
  writeFileSync(
    join(target, "data", "timeline", "2026-02.jsonl"),
    '{"id":"claim","value":1}\n{"id":"other-timeline","value":9}\n',
  );
  git(target, "add", ".");
  git(target, "commit", "-m", "unrelated current changes");
  return { root, source, target };
}

test("refresh staged packet preserves unrelated current JSONL records", () => {
  const { source, target } = setup();
  const preview = refreshStagedAuditPacketPlan({
    sourceRoot: source,
    targetRoot: target,
    recordId: "claim",
  });
  assert.equal(preview.canApply, true);
  assert.deepEqual(preview.timelineChangedIds, ["claim"]);
  assert.deepEqual(preview.changedIds, ["claim", "evidence"]);

  const applied = refreshStagedAuditPacketPlan({
    sourceRoot: source,
    targetRoot: target,
    recordId: "claim",
    apply: true,
  });
  assert.equal(applied.applied, true);
  assert.deepEqual(
    readFileSync(join(target, "data", "news", "2026-02.jsonl"), "utf8").trim().split(/\r?\n/u).map(JSON.parse),
    [
      { id: "evidence", value: 2 },
      { id: "other-news", value: 9 },
    ],
  );
  assert.deepEqual(
    readFileSync(join(target, "data", "timeline", "2026-02.jsonl"), "utf8").trim().split(/\r?\n/u).map(JSON.parse),
    [{ id: "other-timeline", value: 9 }],
  );
  assert.match(git(target, "status", "--short"), /claim-audit-corrections/u);
});

test("refresh staged packet refuses overlap on the claimed timeline record", () => {
  const { source, target } = setup();
  writeFileSync(
    join(target, "data", "timeline", "2026-02.jsonl"),
    '{"id":"claim","value":8}\n{"id":"other-timeline","value":9}\n',
  );
  git(target, "add", ".");
  git(target, "commit", "-m", "change claimed record");
  const result = refreshStagedAuditPacketPlan({
    sourceRoot: source,
    targetRoot: target,
    recordId: "claim",
  });
  assert.equal(result.canApply, false);
  assert.ok(result.blocked.includes("target-overlap"));
  assert.deepEqual(result.overlaps, [{ path: "data/timeline/2026-02.jsonl", id: "claim" }]);
});

test("refresh staged packet refuses an unexpected second timeline record", () => {
  const { source, target } = setup();
  writeFileSync(
    join(source, "data", "timeline", "2026-02.jsonl"),
    '{"id":"other-timeline","value":7}\n',
  );
  git(source, "add", ".");
  const result = refreshStagedAuditPacketPlan({
    sourceRoot: source,
    targetRoot: target,
    recordId: "claim",
  });
  assert.equal(result.canApply, false);
  assert.ok(result.blocked.includes("extra-timeline-records"));
  assert.deepEqual(result.extraTimelineIds, ["other-timeline"]);
});
