import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 16 information-war row stays attributed and removes impossible Dec 18 detail", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks725ssgtdckk324b1fywdfv35813ad3");
  const later = news.find((row) => row.id === "jnd13a5eb1b627977f9fd325917588a9");

  assert.ok(event);
  assert.ok(later);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Cambodian Government Warns/u);
  assert.match(event.description, /Pen Bona/u);
  assert.match(event.description, /fake accounts/u);
  assert.match(event.description, /December 19 Khmer Times/u);
  assert.doesNotMatch(event.description, /toxic gas|Dec 18|December 18/iu);
  assert.equal(later.publishedAt, 1766077200000);
  assert.match(later.summary, /December 19/u);
  assert.match(later.summary, /CNN, the Associated Press and AFP/u);
  assert.doesNotMatch(later.summary, /toxic gas|December 18/iu);
});
