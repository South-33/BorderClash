import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks704hnyz5sq4g9ak0c4qhwnp187a1v1";
const rows = readFileSync("data/timeline/2026-05.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("May 24 detention is grounded in captured Navy reporting", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-05-24");
  assert.equal(row.timeOfDay, "06:00");
  assert.deepEqual(row.evidenceIds, ["fd63ed46a77753370e96ff01ca8e6359"]);
  assert.match(row.description, /seven Thai nationals/i);
  assert.match(row.description, /one detainee said a Cambodian broker/i);
  assert.doesNotMatch(row.description, /absolute border shutdown|sealed border/i);
});
