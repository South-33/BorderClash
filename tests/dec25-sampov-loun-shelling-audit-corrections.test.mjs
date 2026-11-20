import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7460eesga3ngmkq18e6dsd45812fkk";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 25 Sampov Loun row keeps the ministry claim but removes false exact precision", () => {
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Cambodian Defence Ministry Reports 28 Shells/u);
  assert.match(event.description, /from around 10:00 until around noon/u);
  assert.match(event.description, /28 artillery shells/u);
  assert.match(event.description, /Cambodian Defence Ministry allegation/u);
  assert.match(event.description, /no exact timeline time is assigned/u);
  assert.doesNotMatch(event.description, /conflict expands further south/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
