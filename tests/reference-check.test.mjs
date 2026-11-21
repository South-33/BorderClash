import assert from "node:assert/strict";
import test from "node:test";
import { checkReferenceCoverage } from "../research/lib/reference-check.mjs";

test("reference check reports missing current URLs without weakening ID checks", () => {
  const report = checkReferenceCoverage({
    articles: [
      { id: "article-1", sourceUrl: "https://example.com/a/" },
      { id: "article-2", sourceUrl: "https://example.com/b" },
    ],
    timeline: [
      { id: "event-ok", evidenceIds: ["article-1"] },
      { id: "event-missing", evidenceIds: ["missing-article"] },
      { id: "timeline-current-evidence", evidenceIds: ["article-2"] },
    ],
    current: {
      thailand: { assessment: { evidenceIds: ["timeline-current-evidence"] } },
      cambodia: { assessment: { evidenceIds: ["missing-current"] } },
      impact: {
        displaced: { sourceUrl: "https://example.com/a" },
        deaths: { sourceUrl: "https://example.com/not-in-registry" },
      },
    },
  });

  assert.deepEqual(report.missingTimelineEvidenceIds, [
    { eventId: "event-missing", evidenceId: "missing-article" },
  ]);
  assert.deepEqual(report.missingCurrentEvidenceIds, [
    { record: "cambodia", path: "current/cambodia.assessment.evidenceIds", evidenceId: "missing-current" },
  ]);
  assert.equal(report.currentSourceUrls.length, 2);
  assert.deepEqual(report.missingCurrentSourceUrls.map(({ sourceUrl }) => sourceUrl), [
    "https://example.com/not-in-registry",
  ]);
  assert.equal(report.ok, false);
});

test("reference check accepts normalized current URLs and complete evidence IDs", () => {
  const report = checkReferenceCoverage({
    articles: [{ id: "article-1", sourceUrl: "https://example.com/a/" }],
    timeline: [{ id: "event-1", evidenceIds: ["article-1"] }],
    current: {
      impact: { displaced: { sourceUrl: "https://example.com/a" } },
      summary: { keyUpdates: [{ evidenceIds: ["article-1"] }] },
    },
  });

  assert.deepEqual(report.missingTimelineEvidenceIds, []);
  assert.deepEqual(report.missingCurrentEvidenceIds, []);
  assert.deepEqual(report.missingCurrentSourceUrls, []);
  assert.equal(report.ok, true);
});
