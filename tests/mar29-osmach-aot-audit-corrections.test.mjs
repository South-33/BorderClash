import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7fhv0r9m15ha653qak2azmv183v8s1";
const evidenceId = "ad3140585d80988cbd14d695e4e5cfee";
const timeline = readFileSync("data/timeline/2026-03.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2026-03.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Mar 29 O'Smach row uses the AKP mission report without unsupported time, 420m claim, or audit meta-copy", () => {
  assert.equal(event.date, "2026-03-29");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /observation mission at the O'Smach Border Checkpoint/u);
  assert.match(event.description, /transition of ASEAN leadership from Malaysia to the Philippines/u);
  assert.doesNotMatch(event.description, /09:33|9:33|420|captured publisher|previously stored/u);
  assert.doesNotMatch(event.descriptionTh, /09:33|420|ผู้เผยแพร่ที่เก็บไว้|เคยบันทึก/u);
  assert.doesNotMatch(event.descriptionKh, /09:33|420|អត្ថបទអ្នកបោះពុម្ពដែលបានរក្សាទុក|ធ្លាប់បានរក្សាទុក/u);
  assert.ok(news.some((article) => article.id === evidenceId));
  assert.equal(news.some((article) => article.id === "04db83eed1ac67dc7023abccf2e459a8"), false);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
