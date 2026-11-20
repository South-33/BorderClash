import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const id = "ks74y6kkszn0b8bhx5pgra7yeh813xaq";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Jan 6 Thmor Da record is limited to the captured Interior Ministry denial", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-01-06");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["394a36d05ed81fb1f3bac613e2c5fe81"]);
  assert.match(row.title, /Rejects Thai Arms-Cache Claim/u);
  assert.match(row.description, /Statement of Rejection/u);
  assert.match(row.description, /does not independently establish/u);
  assert.doesNotMatch(row.description, /RPG|thousands of rounds/u);
  assert.match(row.descriptionTh, /ปฏิเสธ/u);
  assert.match(row.descriptionKh, /បដិសេធ/u);
});
