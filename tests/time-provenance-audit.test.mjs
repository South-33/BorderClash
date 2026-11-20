import assert from "node:assert/strict";
import test from "node:test";
import {
  auditTimelineTimeProvenance,
  auditTimelineTimeSupport,
  evidenceStatesExactTime,
} from "../research/lib/time-provenance-audit.mjs";

test("time provenance audit flags a same-day article publication time with no textual time support", () => {
  const result = auditTimelineTimeProvenance([
    { id: "event-1", date: "2026-06-19", timeOfDay: "10:00", importance: 95, evidenceIds: ["article-1"] },
  ], [
    {
      id: "article-1",
      publishedAt: Date.parse("2026-06-19T03:00:00Z"),
      sourceUrl: "https://example.com/article-1",
      title: "Thailand responds to maritime arbitration",
      summary: "The government confirmed its participation on Friday.",
    },
  ]);

  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].eventId, "event-1");
  assert.equal(result.candidates[0].reason, "event-time-matches-evidence-publication-time-without-textual-time-support");
  assert.deepEqual(result.candidates[0].matches.map(({ evidenceId }) => evidenceId), ["article-1"]);
  assert.equal(result.candidates[0].matches[0].evidenceSourceUrl, "https://example.com/article-1");
});

test("time support audit triages exact times absent from stored cited evidence without auto-correcting", () => {
  const result = auditTimelineTimeSupport([
    { id: "supported", date: "2026-01-01", timeOfDay: "10:00", importance: 50, evidenceIds: ["a"] },
    { id: "high-risk", date: "2026-01-02", timeOfDay: "14:00", importance: 90, evidenceIds: ["b"] },
    { id: "missing", date: "2026-01-03", timeOfDay: "14:00", importance: 70, evidenceIds: ["missing-article"] },
    { id: "date-only", date: "2026-01-04", evidenceIds: ["b"] },
  ], [
    { id: "a", title: "Briefing at 10:00", sourceUrl: "https://example.com/a" },
    { id: "b", source: "Example News", title: "Afternoon border briefing", sourceUrl: "https://example.com/b" },
  ], { limit: 1 });

  assert.equal(result.reviewOnly, true);
  assert.equal(result.exactTimeEventCount, 3);
  assert.equal(result.supportedByStoredTextCount, 1);
  assert.equal(result.withoutStoredTextSupportCount, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.candidateLimit, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.candidates[0].eventId, "high-risk");
  assert.equal(result.candidates[0].reason, "cited-stored-evidence-text-does-not-state-exact-time");
  assert.equal(result.candidates[0].evidence[0].evidenceSourceUrl, "https://example.com/b");
  assert.deepEqual(result.commonUnsupportedTimes, [{ timeOfDay: "14:00", count: 2 }]);
  assert.deepEqual(result.missingEvidence, [{ eventId: "missing", evidenceIds: ["missing-article"] }]);
});

test("time provenance audit suppresses publication matches when evidence states the exact time", () => {
  const result = auditTimelineTimeProvenance([
    { id: "event-live", date: "2025-12-17", timeOfDay: "15:40", evidenceIds: ["article-live"] },
  ], [
    {
      id: "article-live",
      publishedAt: Date.parse("2025-12-17T08:40:00Z"),
      title: "Conflict Update 3:40 PM: Drone attack reported",
      summary: "The update was issued at 3:40 p.m.",
    },
  ]);

  assert.equal(result.candidateCount, 0);
  assert.equal(evidenceStatesExactTime({ title: "Update at 10.00am" }, "10:00"), true);
});

test("time provenance audit suppresses a publication collision when another cited source states the exact time", () => {
  const result = auditTimelineTimeProvenance([
    { id: "event-briefing", date: "2026-02-18", timeOfDay: "11:00", evidenceIds: ["official", "secondary"] },
  ], [
    {
      id: "official",
      publishedAt: Date.parse("2026-02-18T02:00:00Z"),
      title: "Weekly press briefing on 18 February 2026 at 11:00 hrs.",
    },
    {
      id: "secondary",
      publishedAt: Date.parse("2026-02-18T04:00:00Z"),
      title: "Border situation remains calm",
      summary: "The ministry described recent RBC talks.",
    },
  ]);

  assert.equal(result.candidateCount, 0);
});

test("time provenance audit ignores time-only coincidences on another publication date", () => {
  const result = auditTimelineTimeProvenance([
    { id: "event-older", date: "2026-05-04", timeOfDay: "14:00", evidenceIds: ["article-next-day"] },
  ], [
    {
      id: "article-next-day",
      publishedAt: Date.parse("2026-05-05T07:00:00Z"),
      title: "Cabinet decision reported",
      summary: "The prime minister discussed the previous day's decision.",
    },
  ]);

  assert.equal(result.candidateCount, 0);
});

test("time provenance audit reports missing evidence and ignores date-only events", () => {
  const result = auditTimelineTimeProvenance([
    { id: "event-missing", date: "2026-01-01", timeOfDay: "10:00", evidenceIds: ["missing"] },
    { id: "event-date-only", date: "2026-01-02", evidenceIds: ["missing-date-only"] },
  ], []);

  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.missingEvidence, [{ eventId: "event-missing", evidenceIds: ["missing"] }]);
});
