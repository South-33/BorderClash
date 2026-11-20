import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks71jv2adfpsw7cchdwkvvygvs8136f8";
const evidenceId = "jn7fj3hhs5wyr7swdq8j6n3kh17xcybw";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 16 toxic-gas allegation stays attributed and drops the update-label time", () => {
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Defence Ministry Alleges Toxic Gas Use/u);
  assert.match(event.description, /attempted to infiltrate Prey Chan village and fired toxic gas/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /10:00|captured report|source.*label/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
