import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7bxke6rs1mrdv8bn0awzbde5883a4t";
const evidenceId = "js7b7tn3w5f4x3s9ed40hn5z9d883px2";
const timeline = readFileSync("data/timeline/2026-06.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2026-06.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);
const evidence = news.find((item) => item.id === evidenceId);

test("June 5 IED-image row follows captured Thai PBS metadata and keeps claims attributed", () => {
  assert.equal(event.date, "2026-06-05");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /It Says Show Cambodian Troops/u);
  assert.match(event.description, /Hill 745/u);
  assert.match(event.description, /Nam Yuen district, Ubon Ratchathani/u);
  assert.match(event.description, /Thai Army claimed the troops were from Cambodia's 21st infantry corps/u);
  assert.match(event.description, /does not independently verify/u);
  assert.doesNotMatch(event.description, /12:00/u);
  assert.equal(evidence?.publishedAt, 1780635589000);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
