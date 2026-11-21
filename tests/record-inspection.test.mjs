import assert from "node:assert/strict";
import test from "node:test";
import { buildRecordInspection, compactRecordInspection } from "../research/lib/record-inspection.mjs";

const articles = [
  { id: "article-1", sourceUrl: "https://example.com/a", title: "Article A" },
  { id: "article-2", sourceUrl: "https://example.com/b/", title: "Article B" },
];
const timeline = [
  { id: "event-1", title: "Event", evidenceIds: ["article-1"] },
];

test("record inspection resolves timeline evidence to canonical articles", () => {
  const packet = buildRecordInspection({ id: "event-1", timeline, articles });
  assert.equal(packet.kind, "timeline");
  assert.equal(packet.record.title, "Event");
  assert.deepEqual(packet.evidence.timeline, []);
  assert.deepEqual(packet.evidence.articles.map(({ id }) => id), ["article-1"]);
  assert.deepEqual(packet.evidence.missingEvidenceIds, []);
});

test("record inspection expands current timeline references and direct source URLs", () => {
  const packet = buildRecordInspection({
    id: "current/impact",
    current: {
      impact: {
        displaced: { sourceUrl: "https://example.com/b" },
        deaths: { sourceUrl: "https://example.com/missing" },
        assessment: { evidenceIds: ["event-1"] },
      },
    },
    timeline,
    articles,
  });
  assert.equal(packet.kind, "current");
  assert.deepEqual(packet.evidence.timeline.map(({ id }) => id), ["event-1"]);
  assert.deepEqual(packet.evidence.articles.map(({ id }) => id).sort(), ["article-1", "article-2"]);
  assert.deepEqual(packet.evidence.matchedDirectArticleIds, ["article-2"]);
  assert.deepEqual(packet.evidence.missingDirectSourceUrls, ["https://example.com/missing"]);
});

test("record inspection resolves current summary and activity evidence fields", () => {
  const packet = buildRecordInspection({
    id: "current/summary",
    current: {
      summary: {
        summaryEvidenceIds: ["article-2"],
        activityEvidenceIds: ["event-1"],
        keyUpdates: [{ text: "Update", evidenceIds: ["article-1"] }],
      },
    },
    timeline,
    articles,
  });
  assert.deepEqual(packet.evidence.timeline.map(({ id }) => id), ["event-1"]);
  assert.deepEqual(packet.evidence.articles.map(({ id }) => id).sort(), ["article-1", "article-2"]);
  assert.deepEqual(packet.evidence.missingEvidenceIds, []);
});

test("record inspection returns a news record directly and rejects unknown IDs", () => {
  const packet = buildRecordInspection({
    id: "article-1",
    timeline,
    articles: [{ ...articles[0], __file: "C:/worker-a/data/news/2026-01.jsonl" }, articles[1]],
  });
  assert.equal(packet.kind, "news");
  assert.equal(packet.record.title, "Article A");
  assert.equal(packet.record.__file, undefined);
  assert.deepEqual(packet.evidence.articles, []);
  assert.throws(() => buildRecordInspection({ id: "missing", timeline, articles }), /unknown record id/u);
});

test("news record inspections are independent of worktree loader paths", () => {
  const left = buildRecordInspection({
    id: "article-1",
    articles: [{ ...articles[0], __file: "C:/worker-a/data/news/2026-01.jsonl" }],
  });
  const right = buildRecordInspection({
    id: "article-1",
    articles: [{ ...articles[0], __file: "D:/worker-b/data/news/2026-01.jsonl" }],
  });
  assert.deepEqual(left, right);
});

test("record inspection reports unresolved evidence IDs", () => {
  const packet = buildRecordInspection({
    id: "event-broken",
    timeline: [{ id: "event-broken", evidenceIds: ["missing-article"] }],
    articles,
  });
  assert.deepEqual(packet.evidence.missingEvidenceIds, ["missing-article"]);
});

test("compact record inspection keeps evidence judgment fields without multilingual duplication", () => {
  const packet = buildRecordInspection({
    id: "event-1",
    timeline,
    articles: [{
      ...articles[0],
      source: "Example",
      category: "diplomatic",
      mediaEnvironment: "international",
      status: "active",
      credibility: 80,
      publishedAt: 1_790_000_000_000,
      titleEn: "English title",
      titleTh: "หัวข้อ",
      titleKh: "ចំណងជើង",
      summary: "Claim-tight evidence summary.",
      provenanceId: "example-chain",
    }, articles[1]],
  });
  const compact = compactRecordInspection(packet);
  assert.equal(compact.record.id, "event-1");
  assert.equal(compact.record.title, "Event");
  assert.deepEqual(compact.evidence.articles[0], {
    id: "article-1",
    source: "Example",
    sourceUrl: "https://example.com/a",
    category: "diplomatic",
    mediaEnvironment: "international",
    status: "active",
    credibility: 80,
    publishedAt: 1_790_000_000_000,
    title: "English title",
    summary: "Claim-tight evidence summary.",
    provenanceId: "example-chain",
  });
  assert.equal(Object.hasOwn(compact.evidence.articles[0], "titleTh"), false);
  assert.equal(Object.hasOwn(compact.evidence.articles[0], "titleKh"), false);
});
