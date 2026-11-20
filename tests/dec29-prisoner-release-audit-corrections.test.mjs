import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const timelineId = "ks7cf3pgtvwej1erk8ce8v0bmd813dk9";
const evidenceIds = [
  "js71mvhtzn4ekc95qg5dyz61j57y6kvf",
  "js7f8eva1xywkq8k884sxbqqj57y64t3",
  "js7by0vp8b9x0883esn6qk5zhh7y9egm",
];
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === timelineId);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const inn = news.find((item) => item.id === "js71mvhtzn4ekc95qg5dyz61j57y6kvf");

test("Dec 29 prisoner-release row reflects reconsideration rather than an ordered postponement", () => {
  assert.equal(event.date, "2025-12-29");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, evidenceIds);
  assert.match(event.title, /May Affect Release/u);
  assert.match(event.description, /might need to reconsider/u);
  assert.match(event.description, /Thai Army's account/u);
  assert.doesNotMatch(event.description, /postponement|originally set for Dec 30|14:00/u);
  assert.match(inn.summary, /might need to reconsider/u);
  assert.doesNotMatch(inn.summary, /scheduled for noon on December 30/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
