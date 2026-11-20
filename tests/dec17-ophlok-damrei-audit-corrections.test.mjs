import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks71mqetkxnhnkxnvymhwg2nf5813yqc";
const evidenceId = "0400e129367c374d3502968094f2bbd8";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);
const article = news.find((item) => item.id === evidenceId);

test("Dec 17 O'Phlok Damrei row uses the supported 06:24 artillery incident", () => {
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, "06:24");
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /heavy artillery.*O'Phlok Damrei.*06:24/u);
  assert.match(event.description, /bomb-carrying drone.*19:25.*December 16/u);
  assert.match(event.description, /Cambodian Defence Ministry allegations/u);
  assert.doesNotMatch(event.title + event.description, /daylong|06:25 until 16:00|from 06:25/u);
  assert.match(article.summary, /06:24 on Dec\. 17/u);
  assert.match(article.summary, /Chok Chey at 06:25/u);
  assert.equal(article.credibility, 60);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
