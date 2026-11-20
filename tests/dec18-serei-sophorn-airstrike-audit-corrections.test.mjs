import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7e0z04xyxxrphad5yw3dczmd812nfq";
const evidenceId = "b2ae95119deb98fb49132b97963179d0";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);

test("Dec 18 Serei Sophorn row uses captured AKP times and removes conflated school-panic claims", () => {
  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, "14:32");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Defence Ministry Reports/u);
  assert.match(event.description, /two bombs .* at 14:32/u);
  assert.match(event.description, /another bomb at 14:45/u);
  assert.match(event.description, /does not report five bombing runs or panic/u);
  assert.doesNotMatch(event.description, /five bombing runs on Serei Saophoan/u);
  assert.ok(news.some((article) => article.id === evidenceId && article.source === "AKP"));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
