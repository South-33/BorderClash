import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7dmn2k5h1s856kvw471r89k98134s7";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 22 Poipet flare row keeps the supported 20:59 time without added motives", () => {
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, "20:59");
  assert.match(event.title, /Cambodian Defence Ministry Says/u);
  assert.match(event.description, /two illumination rounds/u);
  assert.match(event.description, /Street 58/u);
  assert.match(event.description, /not independently verified by DAP News/u);
  assert.doesNotMatch(event.description, /no damage|intimidation|civilian airspace/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
