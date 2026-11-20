import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "d090eb5097b9ee80a5f21c11a2d0313e";
const unEvidenceId = "52b1e0113a0961228abce554cb61f3a1";

test("March 8 records Cambodia's UNCLOS ratification taking effect", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-08");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(event.category, "diplomatic");
  assert.equal(event.importance, 80);
  assert.equal(event.title, "Cambodia's UNCLOS Ratification Takes Effect");
  assert.match(event.description, /March 8, 2026/u);
  assert.match(event.description, /February 6, 2026/u);
  assert.match(event.description, /UN Secretary-General/u);
  assert.deepEqual(event.evidenceIds, [unEvidenceId]);
});

test("March 8 UNCLOS milestone stays aligned in Thai and Khmer", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /8/u);
    assert.match(text, /6/u);
    assert.match(text, /2026/u);
    assert.match(text, /UNCLOS/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
});

test("UN Treaty Collection evidence preserves the deposit and effect dates", () => {
  const article = readJsonl("data/news/2026-02.jsonl").find((row) => row.id === unEvidenceId);
  assert.ok(article);
  assert.equal(article.source, "United Nations Treaty Collection");
  assert.equal(article.credibility, 100);
  assert.equal(article.mediaEnvironment, "international");
  assert.equal(article.status, "archived");
  assert.match(article.summary, /February 6, 2026/u);
  assert.match(article.summary, /March 8, 2026/u);
});
