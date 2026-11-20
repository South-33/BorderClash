import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks709r9fp44gaz9w2064wy25t1813m0y";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Jan 23 displaced-return record follows captured Interior Ministry figures", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-01-23");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["a6b8548063ba6873af69025bf751fba8"]);
  assert.match(row.description, /around 82%/u);
  assert.match(row.description, /approximately 530,000/u);
  assert.match(row.description, /More than 118,000/u);
  assert.doesNotMatch(row.description, /mine risks|schools and hospitals/u);
});
