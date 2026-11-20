import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks78t5wqwb0fq5tm51ar9vznmn8136mw";
const evidenceId = "js70q991prctjc7ktm63xdkvp17xjy3c";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const evidence = news.find((item) => item.id === evidenceId);

test("Dec 19 naval-fire row separates Cambodia's 18:30 claim from Thailand's 19:50 warning-shot account", () => {
  assert.equal(event.date, "2025-12-19");
  assert.equal(event.timeOfDay, "18:30");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /18:30 to 18:55/u);
  assert.match(event.description, /19:50.*illumination warning rounds/u);
  assert.match(event.description, /competing claims/u);
  assert.match(event.description, /does not establish a hotel strike, a 10-to-20-shell count/u);
  assert.doesNotMatch(event.description, /A Thai warship reportedly fired 10 to 20 artillery shells/u);
  assert.match(evidence.summary, /18:30 to 18:55/u);
  assert.match(evidence.summary, /19:50.*illumination warning rounds/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /\uFFFD/u);
});
