import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const mergedId = "ks7by0cyjskjm7gws511rxw8wx87eztj";
const retainedId = "ks7e2ey4vhe1b2vmy61ceny65s87jsmt";
const previewArticleId = "jn76n06mw1e610hj9dj8f8063d87fbz4";
const primaryArticleId = "269d255d6c8a5246da304b26352cde94";

test("May 26 keeps the completed New York meeting and removes the same-day preview row", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const retained = timeline.find((row) => row.id === retainedId);
  assert.ok(retained);
  assert.equal(retained.date, "2026-05-26");
  assert.equal(retained.timeOfDay ?? "", "");
  assert.match(retained.title, /Meet in New York/u);
  assert.match(retained.description, /met Thai Deputy Prime Minister and Foreign Minister Sihasak Phuangketkeow/u);
  assert.ok(retained.evidenceIds.includes(primaryArticleId));
  assert.equal(retained.evidenceIds.includes(previewArticleId), false);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
});

test("Khmer Times article is retained as a preview, not represented as a second event", () => {
  const articles = readJsonl("data/news/2026-05.jsonl");
  const preview = articles.find((row) => row.id === previewArticleId);
  assert.ok(preview);
  assert.match(preview.summary, /were expected to meet later that day/u);
  assert.match(preview.summary, /This article was a preview/u);
  assert.match(preview.summary, /did not report the meeting's outcome/u);
  assert.match(preview.summary, /completed meeting is recorded separately/u);
});
