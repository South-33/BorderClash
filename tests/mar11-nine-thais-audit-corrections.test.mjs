import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7cewerx7s5wp3w9smq18jpyd82v623";
const rows = readFileSync("data/timeline/2026-03.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Mar 11 nine-Thais record follows captured FM91 report", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-03-11");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["ecbf6d7ed852d7cef3411a679ef5fc1e"]);
  assert.match(row.description, /four men and five women/u);
  assert.match(row.description, /none had passports/u);
  assert.match(row.description, /told Thai officials/u);
  assert.doesNotMatch(row.description, /rescued by Thai rangers|hiding in temples/u);
});
