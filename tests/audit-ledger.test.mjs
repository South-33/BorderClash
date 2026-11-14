import assert from "node:assert/strict";
import test from "node:test";
import {
  auditLedgerSummary,
  createAuditLedger,
  markAuditItem,
  nextAuditItems,
  recordFingerprint,
  syncAuditLedger,
} from "../research/lib/audit-ledger.mjs";

function record(id, kind, value, overrides = {}) {
  return {
    id,
    kind,
    file: kind === "current" ? "current/summary.json" : kind + "/2026-11.jsonl",
    month: kind === "current" ? "" : "2026-11",
    date: "",
    importance: null,
    priority: kind === "current" ? 0 : kind === "timeline" ? 3 : 4,
    priorityReason: kind === "current" ? "current public synthesis" : "",
    fingerprint: recordFingerprint(value),
    ...overrides,
  };
}

test("audit ledger prioritizes current and known-risk records and counts every status", () => {
  const records = [
    record("news-1", "news", { title: "news" }),
    record("timeline-1", "timeline", { title: "timeline" }),
    record("current/summary", "current", { summary: "current" }),
    record("known", "timeline", { title: "known" }, { priority: 1, priorityReason: "known issue" }),
  ];
  const ledger = createAuditLedger(records, { anchorCommit: "abc", now: 1 });
  assert.deepEqual(nextAuditItems(ledger, 4).map(({ id }) => id), [
    "current/summary",
    "known",
    "timeline-1",
    "news-1",
  ]);
  markAuditItem(ledger, "current/summary", "reviewed", "", { now: 2 });
  markAuditItem(ledger, "known", "unresolved", "Source is inaccessible.", { now: 3 });
  const summary = auditLedgerSummary(ledger);
  assert.equal(summary.total, 4);
  assert.equal(summary.byStatus.reviewed, 1);
  assert.equal(summary.byStatus.unresolved, 1);
  assert.equal(summary.byStatus.pending, 2);
  assert.equal(summary.complete, false);
});

test("audit ledger orders the known chronology correction before the humanitarian scope case", () => {
  const chronology = record("ks7e2x0gqj1y7sydt8aft48ep187n8vk", "timeline", { title: "chronology" }, {
    priority: 1,
    priorityReason: "known retrospective-year chronology error",
  });
  const humanitarian = record("ks7ayq8ftpg07hbm1ctezm4rr5812w3s", "timeline", { title: "humanitarian" }, {
    priority: 2,
    priorityReason: "known humanitarian claimant/scope review",
  });
  const ledger = createAuditLedger([
    record("current/summary", "current", { summary: "current" }),
    humanitarian,
    chronology,
  ], { anchorCommit: "base" });
  assert.deepEqual(nextAuditItems(ledger, 3).map(({ id }) => id), [
    "current/summary",
    chronology.id,
    humanitarian.id,
  ]);
});

test("audit ledger promotes additional humanitarian summary-risk records after the known scope case", () => {
  const ledger = createAuditLedger([
    record("ks79yfakf2xfv51r79bk82ya258128kj", "timeline", { title: "Dec 21" }, {
      priority: 2.5,
      priorityReason: "humanitarian stored-summary numeric mismatch triage",
    }),
    record("ks701ya5evqycp609frpy3rmtd8133ss", "timeline", { title: "Dec 14" }, {
      priority: 2.5,
      priorityReason: "humanitarian stored-summary numeric mismatch triage",
    }),
    record("ks7ayq8ftpg07hbm1ctezm4rr5812w3s", "timeline", { title: "known" }, {
      priority: 2,
      priorityReason: "known humanitarian claimant/scope review",
    }),
    record("timeline-generic", "timeline", { title: "generic" }, {
      priority: 3,
      priorityReason: "high-importance timeline event",
    }),
  ], { anchorCommit: "base" });

  assert.deepEqual(nextAuditItems(ledger, 4).map(({ id }) => id), [
    "ks7ayq8ftpg07hbm1ctezm4rr5812w3s",
    "ks701ya5evqycp609frpy3rmtd8133ss",
    "ks79yfakf2xfv51r79bk82ya258128kj",
    "timeline-generic",
  ]);
});

test("audit sync reopens changed records, adds new records, and requires a disposition for disappearance", () => {
  const original = [
    record("current/summary", "current", { summary: "before" }),
    record("timeline-1", "timeline", { title: "before" }),
    record("news-1", "news", { title: "before" }),
  ];
  const ledger = createAuditLedger(original, { anchorCommit: "base", now: 1 });
  markAuditItem(ledger, "current/summary", "reviewed", "", { now: 2 });
  markAuditItem(ledger, "timeline-1", "corrected", "Checked source.", { now: 2 });
  markAuditItem(ledger, "news-1", "reviewed", "", { now: 2 });

  const updated = [
    record("current/summary", "current", { summary: "after" }),
    record("timeline-1", "timeline", { title: "before" }),
    record("news-2", "news", { title: "new" }),
  ];
  syncAuditLedger(ledger, updated, { commit: "next", now: 10 });
  assert.equal(ledger.currentCommit, "next");
  assert.equal(ledger.items.find(({ id }) => id === "current/summary").status, "pending");
  assert.equal(ledger.items.find(({ id }) => id === "timeline-1").status, "corrected");
  assert.equal(ledger.items.find(({ id }) => id === "news-1").status, "pending");
  assert.equal(ledger.items.find(({ id }) => id === "news-1").present, false);
  assert.equal(ledger.items.find(({ id }) => id === "news-2").status, "pending");
  assert.equal(auditLedgerSummary(ledger).total, 4);
});

test("merged and unresolved audit results require explicit reasons", () => {
  const ledger = createAuditLedger([record("news-1", "news", { title: "x" })], { anchorCommit: "base" });
  assert.throws(() => markAuditItem(ledger, "news-1", "merged"), /requires a reason/u);
  assert.throws(() => markAuditItem(ledger, "news-1", "unresolved"), /requires a reason/u);
  assert.throws(() => markAuditItem(ledger, "news-1", "pending"), /must be reviewed/u);
});
