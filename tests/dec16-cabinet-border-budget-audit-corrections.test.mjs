import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78skz0m45gyxascfse76kwqx8127jw";
const articleId = "js7bba6qvwkr6c0xf21emarzjs7xdnx4";

test("Dec 16 Cabinet border budget is date-only and uses the source-supported amount", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /2\.444 Billion Baht/u);
  assert.match(event.description, /2,444,061,516 baht/u);
  assert.match(event.description, /announced the decision at 14:00/u);
  assert.match(event.description, /does not give an exact time for the Cabinet approval/u);
  assert.doesNotMatch(event.description, /14:30/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
  assert.match(event.descriptionTh, /2,444,061,516 บาท/u);
  assert.match(event.descriptionKh, /2,444,061,516 បាត/u);
});

test("Matichon evidence distinguishes the 14:00 briefing from the Cabinet decision", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString(), "2025-12-16T07:00:00.000Z");
  assert.match(article.summary, /^At 14:00 on December 16, government spokesperson/u);
  assert.match(article.summary, /had approved 2,444,061,516 baht/u);
  assert.match(article.summary, /did not state an exact approval time/u);
  assert.doesNotMatch(article.summary, /14:30/u);
});
