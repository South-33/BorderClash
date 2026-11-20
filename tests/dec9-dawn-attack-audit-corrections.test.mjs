import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7e4kmnky5hty3spjbbz0bvjx813sg4";
const evidenceId = "8a68112629427e40d582ba7f37ff1757";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Dec 9 dawn attack row keeps the supported 04:50 start and removes later-day conflation", () => {
  assert.equal(event.date, "2025-12-09");
  assert.equal(event.timeOfDay, "04:50");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /from 04:50/u);
  assert.match(event.description, /BM-21 multiple-launch rockets/u);
  assert.match(event.description, /Thai military's account/u);
  assert.doesNotMatch(event.description, /5,000 rockets|toxic smoke|Phnom Tranggol/u);
  assert.ok(news.some((article) => article.id === evidenceId));
  assert.ok(!news.some((article) => article.id === "2aacde97bbd1f00a2e69c962b1e7362e"));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
