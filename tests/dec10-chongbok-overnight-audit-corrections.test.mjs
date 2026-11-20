import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks79rcxbe3cef80ynkdg6r3kjd81397h";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Dec 10 Chong Bok record follows the captured Second Army overnight report", () => {
  assert.ok(row);
  assert.equal(row.date, "2025-12-10");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["504f9b4800257de0d769e8d1abc5cc4d"]);
  assert.match(row.description, /09:00 situation update/u);
  assert.match(row.description, /during the previous night/u);
  assert.match(row.description, /more than 80 drone sorties/u);
  assert.match(row.description, /claims in the Thai Second Army report/u);
});
