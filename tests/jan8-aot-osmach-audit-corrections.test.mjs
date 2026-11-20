import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks784gkpjmkfme27ht7e5vqv61813mqk";
const evidenceId = "js79cy4c8hypdn9shyhg85sf5x7yx6rw";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("AOT O'Smach inspection is dated Jan 8 and kept separate from the Jan 6 O'Chik visit", () => {
  assert.equal(event.date, "2026-01-08");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /O'Smach Border Damage/u);
  assert.match(event.description, /separately inspected damage at O'Chik Bridge on January 6/u);
  assert.match(event.description, /Cambodia's account/u);
  assert.doesNotMatch(event.description, /first physical inspection/u);
  assert.doesNotMatch(event.description, /10:30/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
