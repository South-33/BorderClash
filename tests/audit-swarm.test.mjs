import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  acquireIntegrationLock,
  applySemanticWorkerPatch,
  changedJsonlIds,
  captureReadinessTier,
  integrationBlockReasons,
  externalClaimNextAction,
  jsonlWorkerChangesPresent,
  manualCommitIntegrationBlockReasons,
  mergeJsonlRecordText,
  parseJsonText,
  releaseIntegrationLock,
  prioritizeEvidenceReadyCandidates,
  selectSpacedCandidates,
  summarizeHarvest,
  validateWorkerResult,
  workerNextAction,
  workerResultIsIntegrated,
  worktreeCanBePruned,
} from "../research/automation/audit-swarm.mjs";

test("external claim actions prioritize integration-ready manual work without expensive evidence rebuilds", () => {
  assert.equal(externalClaimNextAction({
    ledgerStatuses: ["pending"],
    dirty: false,
    unintegratedCommitCount: 1,
    integratedEquivalentCommitCount: 0,
    frozenVerified: true,
  }), "inspect-review-then-integrate");
  assert.equal(externalClaimNextAction({
    ledgerStatuses: ["pending"],
    dirty: false,
    unintegratedCommitCount: 1,
    integratedEquivalentCommitCount: 0,
    frozenVerified: false,
  }), "verify-committed-work");
  assert.equal(externalClaimNextAction({
    ledgerStatuses: ["pending"],
    dirty: false,
    unintegratedCommitCount: 0,
    integratedEquivalentCommitCount: 1,
    frozenVerified: true,
  }), "reconcile-integrated-work");
  assert.equal(externalClaimNextAction({
    ledgerStatuses: ["pending"],
    dirty: true,
    unintegratedCommitCount: 0,
    frozenVerified: false,
  }), "finish-staged-work");
  assert.equal(externalClaimNextAction({
    ledgerStatuses: ["corrected", "merged"],
    dirty: false,
    unintegratedCommitCount: 0,
    frozenVerified: false,
  }), "release-claim");
  assert.equal(externalClaimNextAction({
    ledgerStatuses: ["pending"],
    dirty: false,
    unintegratedCommitCount: 0,
    frozenVerified: false,
  }), "investigate-or-review");
});

test("integration lock admits one live integrator and fails concurrent callers fast", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-integration-lock-"));
  const first = acquireIntegrationLock(root, { pid: 111, now: 1, isPidAlive: () => true });
  assert.equal(first.ok, true);
  const second = acquireIntegrationLock(root, { pid: 222, now: 2, isPidAlive: () => true });
  assert.equal(second.ok, false);
  assert.equal(second.reason, "integration-lock-held");
  assert.equal(second.owner.pid, 111);
  assert.equal(releaseIntegrationLock(first), true);
});

test("integration lock reclaims a dead integrator lease", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-integration-lock-stale-"));
  const first = acquireIntegrationLock(root, { pid: 111, now: 1, isPidAlive: () => true });
  assert.equal(first.ok, true);
  const second = acquireIntegrationLock(root, { pid: 222, now: 2, isPidAlive: () => false });
  assert.equal(second.ok, true);
  assert.equal(second.owner.pid, 222);
  assert.equal(releaseIntegrationLock(second), true);
});

test("content-equivalence detects semantic integration despite unrelated monthly-file changes", () => {
  const base = '{"id":"a","value":1}\n{"id":"b","value":1}\n';
  const worker = '{"id":"a","value":2}\n{"id":"b","value":1}\n';
  const primary = '{"id":"a","value":2}\n{"id":"b","value":9}\n';
  assert.deepEqual(jsonlWorkerChangesPresent(base, worker, primary), {
    ok: true,
    changedIds: ["a"],
  });
  assert.equal(jsonlWorkerChangesPresent(
    base,
    worker,
    '{"id":"a","value":3}\n{"id":"b","value":9}\n',
  ).ok, false);
});

test("record-aware JSONL merge preserves unrelated primary changes in the same monthly file", () => {
  const base = [
    '{"id":"a","value":1}',
    '{"id":"b","value":1}',
  ].join("\n") + "\n";
  const worker = [
    '{"id":"a","value":2}',
    '{"id":"b","value":1}',
    '{"id":"c","value":3}',
  ].join("\n") + "\n";
  const primary = [
    '{"id":"a","value":1}',
    '{"id":"b","value":9}',
    '{"id":"d","value":4}',
  ].join("\n") + "\n";
  const merged = mergeJsonlRecordText(base, worker, primary);
  assert.equal(merged.ok, true);
  assert.deepEqual(merged.changedIds, ["a", "c"]);
  assert.deepEqual(merged.overlapIds, []);
  assert.deepEqual(merged.text.trim().split(/\r?\n/u).map(JSON.parse), [
    { id: "a", value: 2 },
    { id: "b", value: 9 },
    { id: "d", value: 4 },
    { id: "c", value: 3 },
  ]);
});

test("record-aware JSONL merge refuses a worker record changed independently on primary", () => {
  const merged = mergeJsonlRecordText(
    '{"id":"a","value":1}\n',
    '{"id":"a","value":2}\n',
    '{"id":"a","value":3}\n',
  );
  assert.equal(merged.ok, false);
  assert.deepEqual(merged.overlapIds, ["a"]);
});

test("semantic worker patch avoids a raw cherry-pick conflict while preserving unrelated primary records", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-semantic-integration-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
  git("init", "-b", "main");
  git("config", "user.email", "audit-test@example.invalid");
  git("config", "user.name", "Audit Test");
  mkdirSync(join(root, "data", "timeline"), { recursive: true });
  const path = join(root, "data", "timeline", "2026-03.jsonl");
  writeFileSync(path, '{"id":"a","value":1}\n{"id":"b","value":1}\n', "utf8");
  git("add", ".");
  git("commit", "-m", "base");
  const base = git("rev-parse", "HEAD");

  git("switch", "-c", "worker");
  writeFileSync(path, '{"id":"a","value":2}\n{"id":"b","value":1}\n', "utf8");
  git("add", ".");
  git("commit", "-m", "fix(history): update record a");
  const worker = git("rev-parse", "HEAD");

  git("switch", "main");
  writeFileSync(path, '{"id":"a","value":1}\n{"id":"b","value":9}\n', "utf8");
  git("add", ".");
  git("commit", "-m", "fix(history): update record b");

  const rawPick = spawnSync("git", ["cherry-pick", worker], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(rawPick.status, 0);
  git("cherry-pick", "--abort");

  const semantic = applySemanticWorkerPatch(root, base, worker, ["data/timeline/2026-03.jsonl"]);
  assert.equal(semantic.ok, true);
  assert.deepEqual(
    readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse),
    [
      { id: "a", value: 2 },
      { id: "b", value: 9 },
    ],
  );
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(git("log", "-1", "--format=%s"), "fix(history): update record a");
});

test("manual commit integration blocks missing audit invariants before touching primary", () => {
  assert.deepEqual(manualCommitIntegrationBlockReasons({
    sourceWorktreeFound: true,
    sourceClean: true,
    sourceReviewCurrent: false,
    sourceReviewAccepted: true,
    sourceFrozenVerified: false,
    fileCheckOk: true,
    hasFiles: true,
    overlapOk: true,
    overlapIds: [],
    contentAlreadyIntegrated: false,
  }), [
    "source-review-not-current",
    "source-commit-not-frozen-verified",
  ]);
});

test("already-integrated manual commit is an idempotent no-op even after source receipts are cleaned", () => {
  assert.deepEqual(manualCommitIntegrationBlockReasons({
    sourceWorktreeFound: false,
    sourceClean: false,
    sourceReviewCurrent: false,
    sourceReviewAccepted: false,
    sourceFrozenVerified: false,
    fileCheckOk: true,
    hasFiles: true,
    overlapOk: true,
    overlapIds: ["event-a"],
    contentAlreadyIntegrated: true,
  }), []);
});

test("finished worker is recognized after patch integration and matching ledger mark", () => {
  const result = {
    status: "ready",
    ledger: [
      { id: "event-a", status: "corrected", note: "verified correction" },
    ],
  };
  assert.equal(workerResultIsIntegrated({
    result,
    ownedClaimIds: [],
    patchIntegrated: true,
    ledgerItems: [
      { id: "event-a", status: "corrected", note: "verified correction" },
    ],
  }), true);
  assert.equal(workerResultIsIntegrated({
    result,
    ownedClaimIds: ["event-a"],
    patchIntegrated: true,
    ledgerItems: [
      { id: "event-a", status: "corrected", note: "verified correction" },
    ],
  }), false);
});

test("swarm JSON intake tolerates PowerShell UTF-8 BOM output", () => {
  assert.deepEqual(parseJsonText("\uFEFF{\"status\":\"ready\"}"), { status: "ready" });
});

test("changed JSONL ids detect record-level overlap across timeline and news rows", () => {
  const ids = changedJsonlIds([
    "diff --git a/data/timeline/2026-01.jsonl b/data/timeline/2026-01.jsonl",
    "-{\"id\":\"timeline-a\",\"title\":\"Old\"}",
    "+{\"id\":\"timeline-a\",\"title\":\"New\"}",
    "+{\"id\":\"news-b\",\"summary\":\"Changed\"}",
    "+++ b/data/timeline/2026-01.jsonl",
  ].join("\n"));
  assert.deepEqual(ids, ["news-b", "timeline-a"]);
});

test("worker readiness is derived from current review, frozen verification, and owned claims", () => {
  const task = {
    baseHead: "base",
    record: { id: "event-a" },
  };
  const result = {
    schemaVersion: 1,
    recordId: "event-a",
    status: "ready",
    commit: "head",
    ledger: [
      { id: "event-a", status: "corrected", note: "supported correction" },
      { id: "event-b", status: "merged", note: "merged into event-a" },
    ],
  };
  const resume = {
    review: {
      current: true,
      packetCurrent: true,
      capturedEvidenceCurrent: true,
      claimsSupported: true,
      verdict: "no_change",
    },
    verification: { headVerified: true },
  };
  assert.deepEqual(validateWorkerResult({
    task,
    result,
    workerHead: "head",
    workerDirty: false,
    commitCount: 1,
    ownedClaimIds: ["event-b", "event-a"],
    resume,
  }), {
    ready: true,
    state: "ready",
    issues: [],
  });
});

test("worker self-report cannot bypass missing frozen verification or claim disposition", () => {
  const validation = validateWorkerResult({
    task: { baseHead: "base", record: { id: "event-a" } },
    result: {
      schemaVersion: 1,
      recordId: "event-a",
      status: "ready",
      commit: "head",
      reviewCurrent: true,
      frozenVerified: true,
      ledger: [{ id: "event-a", status: "corrected", note: "done" }],
    },
    workerHead: "head",
    workerDirty: false,
    commitCount: 1,
    ownedClaimIds: ["event-a", "event-b"],
    resume: {
      review: {
        current: true,
        packetCurrent: true,
        capturedEvidenceCurrent: true,
        claimsSupported: true,
        verdict: "no_change",
      },
      verification: { headVerified: false },
    },
  });
  assert.equal(validation.ready, false);
  assert.deepEqual(validation.issues.sort(), [
    "ledger-does-not-cover-owned-claims",
    "worker-head-not-frozen-verified",
  ]);
});

test("coordinator brief turns worker safety state into a small next-action view", () => {
  const ready = {
    slot: 1,
    recordId: "event-a",
    date: "2026-01-01",
    title: "A",
    workerDirty: false,
    commitCount: 1,
    ownedClaimIds: ["event-a"],
    patchIntegrated: false,
    result: { status: "ready" },
    resume: {
      review: { current: true, verdict: "no_change" },
      verification: { headVerified: true },
    },
    machine: { ready: true, state: "ready", issues: [] },
  };
  const drifted = {
    slot: 2,
    recordId: "event-b",
    date: "2026-01-02",
    title: "B",
    workerDirty: false,
    commitCount: 1,
    ownedClaimIds: [],
    patchIntegrated: false,
    result: { status: "ready" },
    resume: {
      review: { current: true, verdict: "no_change" },
      verification: { headVerified: true },
    },
    machine: { ready: false, state: "blocked", issues: ["ledger-does-not-cover-owned-claims"] },
  };
  assert.equal(workerNextAction(ready, { ledgerStatus: "pending" }), "integrate");
  assert.equal(workerNextAction(drifted, { ledgerStatus: "unresolved" }), "reconcile-result-ledger");
  assert.equal(workerNextAction({
    machine: { state: "cleaned", ready: false, issues: [] },
    ownedClaimIds: [],
  }, { ledgerStatus: "corrected" }), "none");
  assert.equal(workerNextAction({
    machine: { state: "blocked", ready: false, issues: ["worker-worktree-missing"] },
    ownedClaimIds: [],
  }, { ledgerStatus: "corrected" }), "none");
  assert.deepEqual(summarizeHarvest({
    sessionId: "session",
    baseHead: "base",
    primaryHead: "primary",
    readyCount: 1,
    integratedCount: 0,
    cleanedCount: 0,
    workers: [ready, drifted],
  }, {
    ledgerItems: [
      { id: "event-a", status: "pending" },
      { id: "event-b", status: "unresolved" },
    ],
    externalClaims: [{ id: "event-c", worktree: "other", label: "other-worker" }],
  }), {
    sessionId: "session",
    baseHead: "base",
    primaryHead: "primary",
    readyCount: 1,
    integratedCount: 0,
    cleanedCount: 0,
    externalClaimCount: 1,
    externalClaimOwners: [{
      label: "other-worker",
      count: 1,
    }],
    workers: [
      {
        slot: 1,
        recordId: "event-a",
        date: "2026-01-01",
        title: "A",
        state: "ready",
        nextAction: "integrate",
        commitCount: 1,
        ownedClaimIds: ["event-a"],
        ledgerStatus: "pending",
        resultStatus: "ready",
        reviewCurrent: true,
        reviewVerdict: "no_change",
        frozenVerified: true,
      },
      {
        slot: 2,
        recordId: "event-b",
        date: "2026-01-02",
        title: "B",
        state: "blocked",
        nextAction: "reconcile-result-ledger",
        commitCount: 1,
        ledgerStatus: "unresolved",
        resultStatus: "ready",
        reviewCurrent: true,
        reviewVerdict: "no_change",
        frozenVerified: true,
        issues: ["ledger-does-not-cover-owned-claims"],
      },
    ],
  });
});

test("integration does not block when reviewed worker content is already present on primary", () => {
  assert.deepEqual(integrationBlockReasons({
    fileCheckOk: true,
    overlapOk: true,
    overlapIds: ["event-a", "article-b"],
    contentAlreadyIntegrated: true,
  }), []);
});

test("integration still blocks overlapping primary edits when worker content is not already present", () => {
  assert.deepEqual(integrationBlockReasons({
    fileCheckOk: true,
    overlapOk: true,
    overlapIds: ["event-a"],
    contentAlreadyIntegrated: false,
  }), ["claimed-record-changed-on-primary"]);
});

test("swarm batch selection spreads workers across nearby event clusters when possible", () => {
  const selected = selectSpacedCandidates([
    { id: "a", date: "2026-01-01" },
    { id: "b", date: "2026-01-02" },
    { id: "c", date: "2026-01-10" },
    { id: "d", date: "2026-02-01" },
  ], 3, 3);
  assert.deepEqual(selected.map(({ id }) => id), ["a", "c", "d"]);
});

test("swarm batch selection fills remaining slots when the queue is tightly clustered", () => {
  const selected = selectSpacedCandidates([
    { id: "a", date: "2026-01-01" },
    { id: "b", date: "2026-01-02" },
    { id: "c", date: "2026-01-03" },
  ], 3, 3);
  assert.deepEqual(selected.map(({ id }) => id), ["a", "b", "c"]);
});

test("capture readiness prefers fully then partially captured candidates within one risk tier", () => {
  const candidates = [
    { id: "none", riskScore: 3 },
    { id: "partial", riskScore: 3 },
    { id: "full", riskScore: 3 },
    { id: "full-later", riskScore: 3 },
  ];
  const readiness = new Map([
    ["none", { articleCount: 1, capturedCount: 0 }],
    ["partial", { articleCount: 2, capturedCount: 1 }],
    ["full", { articleCount: 1, capturedCount: 1 }],
    ["full-later", { articleCount: 2, capturedCount: 2 }],
  ]);
  assert.deepEqual(
    prioritizeEvidenceReadyCandidates(candidates, readiness).map(({ id }) => id),
    ["full", "full-later", "partial", "none"],
  );
  assert.equal(captureReadinessTier(readiness.get("full")), 2);
  assert.equal(captureReadinessTier(readiness.get("partial")), 1);
  assert.equal(captureReadinessTier(readiness.get("none")), 0);
});

test("capture readiness never promotes a lower-risk candidate above a higher-risk one", () => {
  const candidates = [
    { id: "high-blocked", riskScore: 5 },
    { id: "low-ready", riskScore: 3 },
    { id: "high-ready", riskScore: 5 },
  ];
  const readiness = new Map([
    ["high-blocked", { articleCount: 1, capturedCount: 0 }],
    ["low-ready", { articleCount: 1, capturedCount: 1 }],
    ["high-ready", { articleCount: 1, capturedCount: 1 }],
  ]);
  assert.deepEqual(
    prioritizeEvidenceReadyCandidates(candidates, readiness).map(({ id }) => id),
    ["high-ready", "high-blocked", "low-ready"],
  );
});

test("cleanup only prunes clean unclaimed worktrees with no unique patch", () => {
  assert.equal(worktreeCanBePruned({
    isPrimary: false,
    activeClaim: false,
    dirty: false,
    cherryOutput: "",
  }), true);
  assert.equal(worktreeCanBePruned({
    isPrimary: false,
    activeClaim: false,
    dirty: false,
    cherryOutput: "- deadbeef integrated patch",
  }), true);
  assert.equal(worktreeCanBePruned({
    isPrimary: false,
    activeClaim: false,
    dirty: false,
    cherryOutput: "+ deadbeef unique patch",
  }), false);
  assert.equal(worktreeCanBePruned({
    isPrimary: false,
    activeClaim: true,
    dirty: false,
    cherryOutput: "",
  }), false);
  assert.equal(worktreeCanBePruned({
    isPrimary: false,
    activeClaim: false,
    dirty: true,
    cherryOutput: "",
  }), false);
});
