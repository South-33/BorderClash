import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7fjdk4vhmv1cpffhac9rhmkx8137zb";
const evidenceId = "07956d876815cc2df263529720b62367";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Dec 14 Hun Sen clarification separates publication time from event time", () => {
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /air travel remained possible/u);
  assert.match(event.description, /21:15 publication time/u);
  assert.match(event.description, /does not state an exact time/u);
  assert.doesNotMatch(event.description, /23:00|indefinite border suspension|not to panic/u);
  assert.ok(news.some((article) => article.id === evidenceId));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
