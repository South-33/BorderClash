import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks75d8vj4mc44ktyf55vfcjc2d812w31";
const evidenceId = "js7945sfytgtp7swse3r2k2b4d7xr48m";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);
const article = news.find((item) => item.id === evidenceId);

test("Dec 22 temple-flag row drops the unsupported statue-removal claim and exact time", () => {
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /called on temples across Cambodia to raise the national flag/u);
  assert.match(event.description, /does not report Thai troops removing Hindu statues/u);
  assert.doesNotMatch(event.title + event.description, /Statue Removal and Religious Mobilization|removed Cambodian Hindu statues/u);
  assert.doesNotMatch(article.summary, /removed Hindu|statues placed by Cambodia/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
