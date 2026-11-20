import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditRiskQueue, extractStoredEvidenceDates } from "../research/lib/audit-risk.mjs";

function item(id, overrides = {}) {
  return {
    id,
    kind: "timeline",
    status: "pending",
    present: true,
    priority: 3,
    priorityReason: "high-importance timeline event",
    ...overrides,
  };
}

test("stored evidence date extraction recognizes common English date forms", () => {
  const dates = extractStoredEvidenceDates({
    title: "Statement issued 11 December 2025",
    summary: "Damage was reported on Dec. 9 and renewed shelling on December 10, 2025.",
  }, "2025-12-10");
  assert.deepEqual(dates, ["2025-12-09", "2025-12-10", "2025-12-11"]);
});

test("implicit month-day mentions use the nearest year around the event date", () => {
  assert.deepEqual(
    extractStoredEvidenceDates({ summary: "The December 27 ceasefire remained in effect." }, "2026-01-09"),
    ["2025-12-27"],
  );
});

test("risk queue promotes concrete review signals instead of importance alone", () => {
  const ledger = {
    items: [item("clean"), item("conflated"), item("missing"), item("reviewed", { status: "reviewed" })],
  };
  const timeline = [
    { id: "clean", date: "2025-12-10", importance: 99, timeOfDay: "10:00", evidenceIds: ["clean-evidence"] },
    { id: "conflated", date: "2025-12-15", importance: 70, timeOfDay: "13:30", evidenceIds: ["a", "b", "c", "d", "e", "f"] },
    { id: "missing", date: "2025-12-20", importance: 60, evidenceIds: ["does-not-exist"] },
    { id: "reviewed", date: "2025-12-20", importance: 100, evidenceIds: [] },
  ];
  const articles = [
    { id: "clean-evidence", title: "Briefing at 10:00 on December 10", publishedAt: Date.parse("2025-12-10T03:00:00Z") },
    { id: "a", source: "A", summary: "Proposal on December 13", publishedAt: Date.parse("2025-12-13T03:00:00Z") },
    { id: "b", source: "B", summary: "Meeting on December 16", publishedAt: Date.parse("2025-12-16T03:00:00Z") },
    { id: "c", source: "C", summary: "Follow-up December 18", publishedAt: Date.parse("2025-12-18T03:00:00Z") },
    { id: "d", source: "D", summary: "Analysis", publishedAt: Date.parse("2025-12-18T05:00:00Z") },
    { id: "e", source: "E", summary: "Analysis", publishedAt: Date.parse("2025-12-19T05:00:00Z") },
    { id: "f", source: "F", summary: "Analysis", publishedAt: Date.parse("2025-12-20T05:00:00Z") },
  ];

  const result = buildAuditRiskQueue({ ledger, timeline, articles, limit: 10 });
  assert.equal(result.pendingTimelineCount, 3);
  assert.deepEqual(result.candidates.map(({ id }) => id), ["conflated", "missing"]);
  assert.ok(result.candidates[0].riskScore > result.candidates[1].riskScore);
  assert.deepEqual(result.candidates[0].signals.map(({ code }) => code), [
    "unsupported-exact-time",
    "many-evidence-records",
    "many-source-voices",
    "wide-publication-span",
    "stored-dates-exclude-event-date",
  ]);
});
