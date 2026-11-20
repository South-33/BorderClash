import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  auditWorktreeNeedsConflictScan,
  auditWorktreeTimelineStatus,
  claimsFromTimelineDiff,
  createAuditClaim,
  createAuditClaims,
  loadAuditClaims,
  parseWorktreePorcelain,
  pickUnclaimedCandidates,
  releaseAuditClaim,
  shouldScanAuditWorktree,
} from "../research/lib/audit-worktree-claims.mjs";

test("worktree parser preserves path, head, and branch state", () => {
  const entries = parseWorktreePorcelain([
    "worktree D:/Project/BorderClash",
    "HEAD abc123",
    "branch refs/heads/main",
    "",
    "worktree D:/Project/BorderClash/.work/example-audit",
    "HEAD def456",
    "detached",
    "",
  ].join("\n"));

  assert.deepEqual(entries, [
    {
      path: "D:/Project/BorderClash",
      head: "abc123",
      branch: "refs/heads/main",
      detached: false,
    },
    {
      path: "D:/Project/BorderClash/.work/example-audit",
      head: "def456",
      branch: "",
      detached: true,
    },
  ]);
});

test("audit picker skips primary and frozen verifier worktrees", () => {
  const primary = "D:/Project/BorderClash";
  assert.equal(shouldScanAuditWorktree(primary, primary), false);
  assert.equal(shouldScanAuditWorktree(`${primary}/.work/fv/abc`, primary), false);
  assert.equal(shouldScanAuditWorktree(`${primary}/.work/topic-audit`, primary), true);
});

test("clean worktrees already contained in primary do not need conflict scans", () => {
  const ancestors = new Set(["aaa", "bbb"]);
  assert.equal(auditWorktreeNeedsConflictScan({
    head: "aaa",
    primaryAncestorHeads: ancestors,
    timelineDirty: false,
  }), false);
  assert.equal(auditWorktreeNeedsConflictScan({
    head: "aaa",
    primaryAncestorHeads: ancestors,
    timelineDirty: true,
  }), true);
  assert.equal(auditWorktreeNeedsConflictScan({
    head: "ccc",
    primaryAncestorHeads: ancestors,
    timelineDirty: false,
  }), true);
});

test("broken worktree status probes are reported instead of aborting audit selection", () => {
  const result = auditWorktreeTimelineStatus("D:/repo/.work/broken", () => {
    throw new Error("fatal: not a git repository");
  });
  assert.deepEqual(result, {
    ok: false,
    timelineDirty: false,
    error: "fatal: not a git repository",
  });
});

test("timeline diff claims only stable IDs actually changed in that worktree", () => {
  const candidates = [
    { id: "event-a", date: "2025-12-01", title: "A" },
    { id: "event-b", date: "2025-12-02", title: "B" },
  ];
  const diff = [
    "- {\"id\":\"event-a\",\"title\":\"Old\"}",
    "+ {\"id\":\"event-a\",\"title\":\"New\"}",
    "+ {\"id\":\"unrelated\",\"title\":\"Other\"}",
  ].join("\n");
  assert.deepEqual(claimsFromTimelineDiff(candidates, diff, "D:/repo/.work/audit-a"), [
    {
      id: "event-a",
      worktree: "D:/repo/.work/audit-a",
      label: "audit-a",
    },
  ]);
});

test("picker keeps risk order while excluding claimed records", () => {
  const candidates = [
    { id: "a", date: "2025-12-01", title: "A", riskScore: 9 },
    { id: "b", date: "2025-12-02", title: "B", riskScore: 8 },
    { id: "c", date: "2025-12-03", title: "C", riskScore: 7 },
  ];
  const claims = [{ id: "a", worktree: "D:/repo/.work/a", label: "a" }];
  const result = pickUnclaimedCandidates(candidates, claims, 2);
  assert.deepEqual(result.selected.map(({ id }) => id), ["b", "c"]);
  assert.deepEqual(result.claimed.map(({ id }) => id), ["a"]);
});

test("explicit audit claim is atomic and idempotent for its owner", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-audit-claims-"));
  const claimRoot = join(root, "claims");
  const owner = join(root, "audit-a");
  const competitor = join(root, "audit-b");
  mkdirSync(owner);
  mkdirSync(competitor);

  const first = createAuditClaim(claimRoot, { id: "event-a", worktree: owner, claimedAt: 1 });
  const repeat = createAuditClaim(claimRoot, { id: "event-a", worktree: owner, claimedAt: 2 });
  const blocked = createAuditClaim(claimRoot, { id: "event-a", worktree: competitor, claimedAt: 3 });

  assert.equal(first.created, true);
  assert.equal(repeat.created, false);
  assert.equal(repeat.owned, true);
  assert.equal(blocked.created, false);
  assert.equal(blocked.owned, false);
  assert.equal(blocked.claim.worktree, owner);
});

test("explicit claims feed the picker and stale worktree claims are removed", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-audit-claims-"));
  const claimRoot = join(root, "claims");
  const active = join(root, "audit-active");
  const gone = join(root, "audit-gone");
  mkdirSync(active);
  createAuditClaim(claimRoot, { id: "a", worktree: active, claimedAt: 1 });
  createAuditClaim(claimRoot, { id: "b", worktree: gone, claimedAt: 2 });

  const loaded = loadAuditClaims(claimRoot, [active]);
  assert.deepEqual(loaded.claims.map(({ id }) => id), ["a"]);
  assert.deepEqual(loaded.staleRemoved.map(({ id }) => id), ["b"]);

  const candidates = [
    { id: "a", date: "2026-01-01", title: "A", riskScore: 3 },
    { id: "b", date: "2026-01-02", title: "B", riskScore: 3 },
  ];
  const picked = pickUnclaimedCandidates(candidates, loaded.claims, 1);
  assert.deepEqual(picked.selected.map(({ id }) => id), ["b"]);
});

test("only the owner can release a claim unless release is forced", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-audit-claims-"));
  const claimRoot = join(root, "claims");
  const owner = join(root, "audit-a");
  const competitor = join(root, "audit-b");
  createAuditClaim(claimRoot, { id: "event-a", worktree: owner, claimedAt: 1 });

  assert.throws(() => releaseAuditClaim(claimRoot, "event-a", competitor), /belongs to/u);
  assert.equal(releaseAuditClaim(claimRoot, "event-a", owner).released, true);
  assert.equal(releaseAuditClaim(claimRoot, "event-a", owner).released, false);

  createAuditClaim(claimRoot, { id: "event-b", worktree: owner, claimedAt: 2 });
  assert.equal(releaseAuditClaim(claimRoot, "event-b", competitor, { force: true }).released, true);
});

test("cluster claims roll back newly acquired ids when one related id is owned elsewhere", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-audit-cluster-claims-"));
  const claimRoot = join(root, "claims");
  const owner = join(root, "audit-a");
  const competitor = join(root, "audit-b");
  createAuditClaim(claimRoot, { id: "event-b", worktree: competitor, claimedAt: 1 });

  const result = createAuditClaims(claimRoot, {
    ids: ["event-a", "event-b", "event-c"],
    worktree: owner,
    claimedAt: 2,
  });

  assert.equal(result.owned, false);
  assert.equal(result.conflict.id, "event-b");
  const loaded = loadAuditClaims(claimRoot, [owner, competitor]);
  assert.deepEqual(loaded.claims.map(({ id }) => id), ["event-b"]);
});

test("cluster claims are idempotent for the same worktree", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-audit-cluster-owned-"));
  const claimRoot = join(root, "claims");
  const owner = join(root, "audit-a");

  assert.equal(createAuditClaims(claimRoot, {
    ids: ["event-b", "event-a"],
    worktree: owner,
    claimedAt: 1,
  }).owned, true);
  assert.equal(createAuditClaims(claimRoot, {
    ids: ["event-a", "event-b"],
    worktree: owner,
    claimedAt: 2,
  }).owned, true);
  assert.deepEqual(loadAuditClaims(claimRoot, [owner]).claims.map(({ id }) => id).sort(), ["event-a", "event-b"]);
});
