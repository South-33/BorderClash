import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks74z6ktejkd7y2ytn3vxa8t1n8137a1";
const evidenceId = "5fde322fffff8cad3f565588eea0027c";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Dec 10 school row uses the official Cambodian statement without a war-crime overstatement", () => {
  assert.equal(event.date, "2025-12-10");
  assert.equal(event.timeOfDay, "15:45");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /two 155mm artillery shells/u);
  assert.match(event.description, /Khvav Lekh Primary School/u);
  assert.match(event.description, /grave breach of the ceasefire/u);
  assert.match(event.description, /does not independently verify responsibility/u);
  assert.doesNotMatch(event.description, /war crime/u);
  assert.ok(news.some((article) => article.id === evidenceId));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
