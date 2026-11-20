import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("January 30 treaty exchange is a date-only Arria-formula event without a fabricated specific treaty accusation", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl")
    .find((row) => row.id === "ks7ec437c6y1j395ph2cwxtsqs812spd");
  assert.ok(event);
  assert.equal(event.date, "2026-01-30");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Arria Meeting/u);
  assert.match(event.description, /Arria-formula meeting/u);
  assert.match(event.description, /did not quote Cambodia directly accusing Thailand/u);
  assert.doesNotMatch(event.description, /Cambodia accused Thailand of violating the 1907/u);
  assert.deepEqual(event.evidenceIds, ["jn701sv01gg6z9mbgd21ybt4dd80a3t0"]);
});

test("Khmer Times summary separates the direct envoy exchange from its 1907 treaty and JBC background", () => {
  const article = readJsonl("data/news/2026-02.jsonl")
    .find((row) => row.id === "jn701sv01gg6z9mbgd21ybt4dd80a3t0");
  assert.ok(article);
  assert.match(article.summary, /Arria-formula meeting/u);
  assert.match(article.summary, /separately as background/u);
  assert.doesNotMatch(article.summary, /Cambodia accused Thailand/u);
});
