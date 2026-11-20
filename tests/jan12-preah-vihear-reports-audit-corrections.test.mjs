import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks725v2w3dz1hkevnappw03xs18126q6";
const evidenceId = "0a465b08a36cef46eb2f274289bcea1c";
const timeline = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Jan 12 Preah Vihear row records the report submission without later damage/restoration findings", () => {
  assert.equal(event.date, "2026-01-12");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Submits Preah Vihear Damage Reports/u);
  assert.match(event.description, /142 damaged locations/u);
  assert.match(event.description, /42 in surrounding areas/u);
  assert.match(event.description, /Cambodia's official position/u);
  assert.doesNotMatch(event.description, /562|5-10 years|30 years|10:00|captured report|does not contain/u);
  assert.ok(news.some((article) => article.id === evidenceId && article.source === "AKP"));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /ï¿½/u);
});
