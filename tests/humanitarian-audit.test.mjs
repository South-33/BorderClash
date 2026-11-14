import assert from "node:assert/strict";
import test from "node:test";
import {
  auditHumanitarianSummaryRisk,
  extractMeaningfulNumericClaims,
} from "../research/lib/humanitarian-audit.mjs";

test("humanitarian audit flags dense single-source numeric claims absent from the stored evidence summary", () => {
  const result = auditHumanitarianSummaryRisk([
    {
      id: "event-risk",
      category: "humanitarian",
      date: "2025-12-18",
      title: "Day 12: Fatalities Reach 60; Displacement Hits 700k",
      description: "Thai displacement reached 270,000 while Cambodian displacement exceeded 430,000.",
      evidenceIds: ["article-one"],
    },
  ], [
    {
      id: "article-one",
      title: "Ministry update",
      summary: "The ministry reported 18 civilian deaths, 78 injuries and almost 500,000 people displaced.",
    },
  ]);

  assert.equal(result.candidateCount, 1);
  assert.deepEqual(result.candidates[0].unrepresentedValues, [60, 700000, 270000, 430000]);
  assert.match(result.candidates[0].reviewNote, /open the source or preserved capture/u);
});

test("humanitarian audit does not flag claims represented in the stored evidence summary", () => {
  const result = auditHumanitarianSummaryRisk([
    {
      id: "event-covered",
      category: "humanitarian",
      title: "60 fatalities; 270,000 Thai and 430,000 Cambodian residents displaced",
      description: "Combined displacement reached 700k.",
      evidenceIds: ["article-covered"],
    },
  ], [
    {
      id: "article-covered",
      summary: "The report states 60 fatalities, 270,000 Thai and 430,000 Cambodian residents displaced, 700k combined.",
    },
  ]);

  assert.equal(result.candidateCount, 0);
});

test("humanitarian audit stays conservative for multi-source events", () => {
  const result = auditHumanitarianSummaryRisk([
    {
      id: "event-multi",
      category: "humanitarian",
      title: "60 fatalities and 700k displaced",
      description: "270,000 Thai and 430,000 Cambodian residents were displaced.",
      evidenceIds: ["article-a", "article-b"],
    },
  ], [
    { id: "article-a", summary: "One source covers casualties." },
    { id: "article-b", summary: "Another source covers displacement." },
  ]);

  assert.equal(result.candidateCount, 0);
});

test("numeric extraction normalizes k suffixes but ignores years and small incidental numbers", () => {
  assert.deepEqual(
    extractMeaningfulNumericClaims("Day 12 in 2025: 60 deaths, 270,000 displaced and 430k elsewhere"),
    [60, 270000, 430000],
  );
});

test("humanitarian audit reports missing evidence without creating a candidate", () => {
  const result = auditHumanitarianSummaryRisk([
    {
      id: "event-missing",
      category: "humanitarian",
      title: "60 fatalities and 700k displaced",
      description: "270,000 Thai and 430,000 Cambodian residents were displaced.",
      evidenceIds: ["missing"],
    },
  ], []);

  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.missingEvidence, [{ eventId: "event-missing", evidenceIds: ["missing"] }]);
});
