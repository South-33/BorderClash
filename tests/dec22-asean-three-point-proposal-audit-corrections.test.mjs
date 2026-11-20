import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78snsx9v0tqmg2zw9xey95gh8131jf";
const articleId = "jn7a71tn62ccmrwtr8p6yfgb8n7xw2br";

test("Cambodia's three ASEAN proposals stay on the Dec 22 meeting date without invented time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Special ASEAN Foreign Ministers/u);
  assert.match(event.description, /December 22/u);
  assert.match(event.description, /safe return of civilians/u);
  assert.match(event.description, /18 Cambodian soldiers/u);
  assert.match(event.description, /Cambodia’s proposals, not terms agreed by the meeting/u);
  assert.doesNotMatch(event.description, /10:00/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
});

test("Khmer Times summary preserves the Dec 22 meeting chronology and proposal scope", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.match(article.summary, /Meeting in Kuala Lumpur on December 22/u);
  assert.match(article.summary, /three proposals/u);
  assert.match(article.summary, /withdrawal of both sides’ forces/u);
  assert.match(article.summary, /18 detained Cambodian soldiers/u);
});
