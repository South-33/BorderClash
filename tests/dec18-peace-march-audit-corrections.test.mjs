import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
const eventId = "ks7830zr8gzqpkde2g5pm17ng1812h7a";
const articleId = "jn4db1b23d8f3a34561bd469845d2c85";
test("Dec 18 peace march keeps the event date but removes unsupported exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /^Khmer Times Reports More Than 300,000/u);
  assert.match(event.description, /previous day/u);
  assert.match(event.description, /Som Ratana/u);
  assert.match(event.description, /does not give an exact start time/u);
  assert.doesNotMatch(event.description, /support the government's defense/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
});
test("Khmer Times article uses its captured Dec 19 publication date and bounded summary", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString(), "2025-12-19T00:00:00.000Z");
  assert.match(article.summary, /more than 300,000/u);
  assert.match(article.summary, /previous day/u);
  assert.match(article.summary, /Som Ratana/u);
});
