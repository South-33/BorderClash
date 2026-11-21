import assert from "node:assert/strict";
import test from "node:test";
import { checkTimelineChronology } from "../research/lib/chronology-check.mjs";

test("chronology check flags an event copied from a one-year retrospective publication date", () => {
  const result = checkTimelineChronology([
    { id: "event-retrospective", date: "2026-05-28", evidenceIds: ["article-retrospective"] },
  ], [
    {
      id: "article-retrospective",
      publishedAt: Date.parse("2026-05-28T00:00:00Z"),
      title: "May 28 border skirmish has grown into a regional flashpoint",
      summary: "This article reflects on the one-year anniversary of the May 28 border clash.",
    },
  ]);

  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].eventId, "event-retrospective");
  assert.equal(result.candidates[0].reason, "event-date-matches-retrospective-evidence-publication");
});

test("chronology check does not flag ordinary same-day reporting", () => {
  const result = checkTimelineChronology([
    { id: "event-current", date: "2026-05-28", evidenceIds: ["article-current"] },
  ], [
    {
      id: "article-current",
      publishedAt: Date.parse("2026-05-28T10:00:00Z"),
      title: "Border commanders meet after morning clash",
      summary: "Commanders met after a clash earlier the same day.",
    },
  ]);

  assert.equal(result.candidateCount, 0);
});

test("chronology check ignores generic prior-year and prospective duration wording", () => {
  const result = checkTimelineChronology([
    { id: "event-context", date: "2026-01-09", evidenceIds: ["article-context", "article-duration"] },
  ], [
    {
      id: "article-context",
      publishedAt: Date.parse("2026-01-09T10:00:00Z"),
      title: "Leaders revisit talks after tensions last year",
      summary: "The meeting took place today after disputes last year.",
    },
    {
      id: "article-duration",
      publishedAt: Date.parse("2026-01-09T11:00:00Z"),
      title: "Defense minister orders troops to hold border for one year",
      summary: "The deployment begins today and may last one year.",
    },
  ]);

  assert.equal(result.candidateCount, 0);
});

test("chronology check reports missing evidence ids without inventing candidates", () => {
  const result = checkTimelineChronology([
    { id: "event-broken", date: "2026-05-28", evidenceIds: ["missing"] },
  ], []);

  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.missingEvidence, [{ eventId: "event-broken", evidenceIds: ["missing"] }]);
});
