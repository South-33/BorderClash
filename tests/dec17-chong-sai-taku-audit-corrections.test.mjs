import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("December 17 Chong Sai Taku row uses the noon report without inventing casualty location", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks77vn272rsg3xfc55f6gvwmq9813f3q");
  const article = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "js763jrrekk9d1h9xcfx6tser17xe8vh");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, "12:00");
  assert.match(event.description, /covering 12:00 on December 17/u);
  assert.match(event.description, /did not say that the two soldiers were killed at Chong Sai Taku/u);
  assert.match(event.description, /Thai military claim/u);
  assert.doesNotMatch(event.description, /On Dec 18/u);
  assert.deepEqual(event.evidenceIds, [article.id]);
  assert.match(article.summary, /December 17 situation report covering the 12:00 period/u);
  assert.match(article.summary, /without stating that they were killed at Chong Sai Taku/u);
});
