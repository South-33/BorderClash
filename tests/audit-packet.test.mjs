import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditPacket } from "../research/lib/audit-packet.mjs";

const articles = [
  { id: "article-1", sourceUrl: "https://example.com/a", title: "Article A" },
  { id: "article-2", sourceUrl: "https://example.com/b/", title: "Article B" },
];
const timeline = [
  { id: "event-1", title: "Event", evidenceIds: ["article-1"] },
];

test("audit packet resolves timeline evidence to canonical articles", () => {
  const packet = buildAuditPacket({ id: "event-1", timeline, articles });
  assert.equal(packet.kind, "timeline");
  assert.equal(packet.record.title, "Event");
  assert.deepEqual(packet.evidence.timeline, []);
  assert.deepEqual(packet.evidence.articles.map(({ id }) => id), ["article-1"]);
  assert.deepEqual(packet.evidence.missingEvidenceIds, []);
});

test("audit packet expands current timeline references and direct source URLs", () => {
  const packet = buildAuditPacket({
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

test("audit packet resolves current summary and activity evidence fields", () => {
  const packet = buildAuditPacket({
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

test("audit packet returns a news record directly and rejects unknown IDs", () => {
  const packet = buildAuditPacket({
    id: "article-1",
    timeline,
    articles: [{ ...articles[0], __file: "C:/worker-a/data/news/2026-01.jsonl" }, articles[1]],
  });
  assert.equal(packet.kind, "news");
  assert.equal(packet.record.title, "Article A");
  assert.equal(packet.record.__file, undefined);
  assert.deepEqual(packet.evidence.articles, []);
  assert.throws(() => buildAuditPacket({ id: "missing", timeline, articles }), /unknown audit record id/u);
});

test("news audit packets are independent of worktree loader paths", () => {
  const left = buildAuditPacket({
    id: "article-1",
    articles: [{ ...articles[0], __file: "C:/worker-a/data/news/2026-01.jsonl" }],
  });
  const right = buildAuditPacket({
    id: "article-1",
    articles: [{ ...articles[0], __file: "D:/worker-b/data/news/2026-01.jsonl" }],
  });
  assert.deepEqual(left, right);
});

test("audit packet reports unresolved evidence IDs", () => {
  const packet = buildAuditPacket({
    id: "event-broken",
    timeline: [{ id: "event-broken", evidenceIds: ["missing-article"] }],
    articles,
  });
  assert.deepEqual(packet.evidence.missingEvidenceIds, ["missing-article"]);
});

test("audit packet represents a proposed timeline deletion without asserting the baseline row", () => {
  const deletedRecord = { id: "event-deleted", date: "2025-12-14", timeOfDay: "09:20", title: "Old claim", evidenceIds: ["article-1"] };
  const packet = buildAuditPacket({
    id: deletedRecord.id,
    timeline,
    articles,
    deletedRecord,
  });
  assert.equal(packet.kind, "timeline");
  assert.equal(packet.proposedAction, "delete");
  assert.equal(packet.record, null);
  assert.deepEqual(packet.baselineRecord, deletedRecord);
  assert.deepEqual(packet.evidence.articles.map(({ id }) => id), ["article-1"]);
});
