import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const timelineId = "ks7fvk7zfnsw0yaqwttm52hzjn813m4k";
const evidenceId = "js7czdhhrnrawvsyx9smr8q36s7xmdye";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === timelineId);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const article = news.find((item) => item.id === evidenceId);

test("Dec 20 silt-barrier row keeps 16:00 attributed but does not assign it as event time", () => {
  assert.equal(event.date, "2025-12-20");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Thai Border Command Reports/u);
  assert.match(event.description, /Thai command said dismantling began at 16:00/u);
  assert.match(event.description, /cut a logistics route in the Koh Kong bridge area/u);
  assert.match(event.description, /Thai command's account/u);
  assert.match(event.description, /no exact event time is assigned/u);
  assert.doesNotMatch(event.description, /destroy the Koh Kong bridge logistics route/u);
  assert.match(article.summary, /Thai command said dismantling began at 16:00/u);
  assert.doesNotMatch(article.summary, /tactical concession|F-16/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
