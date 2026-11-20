import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7fdwcyhawwmtrxr78gp9syc1813jc9";
const evidenceIds = ["jn75s1gd2mh53edsvhw3m8esx57xttct", "jn7fk72kmjk3wd8f7dhz72sxn57xvhd5"];
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 23 attack summary separates F-16 windows from Poipet artillery and drops ambiguous timeOfDay", () => {
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, evidenceIds);
  assert.match(event.description, /between 14:30 and 15:10/u);
  assert.match(event.description, /10 shells .* Poipet, at 16:10/u);
  assert.match(event.description, /Stung Bot area at 13:37/u);
  assert.match(event.description, /Cambodian side's account/u);
  assert.match(event.description, /no single exact event time is assigned/u);
  assert.doesNotMatch(event.title, /F-16 Raids Hit Preah Vihear and Poipet/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
