import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const id = "ks76brhwt14sr5pj68f299s25x813pah";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Dec 25 row represents fighting summarized by the Second Army on Dec 26", () => {
  assert.ok(row);
  assert.equal(row.date, "2025-12-25");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["js716da33fcm0w5k9ym01984hs7y08s6"]);
  assert.match(row.title, /Dec 25 Fighting/u);
  assert.match(row.description, /09:00 briefing on December 26/u);
  assert.match(row.description, /fighting during December 25/u);
  assert.match(row.description, /PMN-2/u);
  assert.match(row.description, /Second Army Region/u);
});
