import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 31 border statement separates the statement date from the Jan 29 survey proposal", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks72gvxy3awmp3kgn2wv585f6h813n06");
  const news = readJsonl("data/news/2026-02.jsonl");
  const article = news.find((row) => row.id === "jn749fqcvt7tpx8h1dyf00r40180agmg");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-01-31");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /another note on January 29/u);
  assert.match(event.description, /between February 9 and 13/u);
  assert.match(event.description, /clearing and destruction/u);
  assert.match(event.description, /remain Cambodia's position/u);
  assert.doesNotMatch(event.description, /meeting for Joint Survey Teams from February 9/u);
  assert.deepEqual(event.evidenceIds, ["jn749fqcvt7tpx8h1dyf00r40180agmg"]);
  assert.match(article.summary, /In a January 31 statement/u);
  assert.match(article.summary, /another note on January 29/u);
});
