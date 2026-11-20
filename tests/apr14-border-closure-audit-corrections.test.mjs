import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks79xfeaptqdejtq6gj40bkkqs84v0py";
const rows = readFileSync("data/timeline/2026-04.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Apr 14 checkpoint record follows captured Navy-source reporting", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-04-14");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["85598dafaf0f48ccc6e1631e789117d9"]);
  assert.match(row.description, /Royal Thai Navy source/i);
  assert.match(row.description, /no formal Cambodian request/i);
  assert.match(row.description, /national security/i);
  assert.doesNotMatch(row.description, /killed over 100|killed at least 101/i);
  assert.doesNotMatch(row.description, /unsupported|audit|no exact event time/i);
});
