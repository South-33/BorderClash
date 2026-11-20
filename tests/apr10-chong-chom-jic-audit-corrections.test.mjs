import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks77kxbmszawx5kx1mh8xbk78s84j14e";
const rows = readFileSync("data/timeline/2026-04.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Apr 10 Chong Chom rebuttal follows captured JIC reporting", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-04-10");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["js75p0k936gsmycgzsc0qjwy2n84jzxg"]);
  assert.match(row.description, /Joint Information Center/u);
  assert.match(row.description, /had not crossed, expanded or changed positions/u);
  assert.match(row.description, /claims in the Thai JIC statement/u);
  assert.doesNotMatch(row.description, /strictly within Thai boundaries/u);
});
