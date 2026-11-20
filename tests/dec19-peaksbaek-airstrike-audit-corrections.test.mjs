import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks74x7c7vvbftpqfjgbzsb09ph813jad";
const evidenceId = "66cb4562fbed1b13a6205a65a1b65050";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 19 Peak Sbaek row follows the captured 15:30 AKP report", () => {
  assert.equal(event.date, "2025-12-19");
  assert.equal(event.timeOfDay, "15:30");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /F-16 fighter jets bombed the Peak Sbaek area/u);
  assert.match(event.description, /Cambodia's official position/u);
  assert.match(event.description, /not independently established/u);
  assert.doesNotMatch(event.description, /Serei Saophoan|Banteay Chhmar gas station/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /\uFFFD/u);
});
