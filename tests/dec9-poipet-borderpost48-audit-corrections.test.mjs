import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78w87ctcms031vbq6ydbkptn813gx5";
const articleId = "jn7164ws08ptrg4c2ry46fmt6x7xe4zq";

test("Dec 9 Poipet fighting stays date-only when the source says around 11:00", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-09");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Fierce Fighting 16 km from Poipet/u);
  assert.match(event.description, /frontline reports/u);
  assert.match(event.description, /around 11:00/u);
  assert.match(event.description, /Border Post 48/u);
  assert.doesNotMatch(event.description, /casino being destroyed|drone command station/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
});

test("Khmer Times summary stays within its captured Dec 9 frontline report", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.credibility, 60);
  assert.match(article.summary, /around 11:00 on December 9/u);
  assert.match(article.summary, /approximately 16 kilometres from Poipet/u);
  assert.match(article.summary, /fighting was ongoing/u);
  assert.doesNotMatch(article.summary, /widening of the conflict zone|casino|drone command station/iu);
});
