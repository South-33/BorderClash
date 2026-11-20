import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks721w20n1x460rv41sk5bv8bs812phk";
const row = () => readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("Jan 3 Ban Laem repatriation uses the captured PPTV event time and details", () => {
  const event = row();
  assert.equal(event.date, "2026-01-03");
  assert.equal(event.timeOfDay, "11:00");
  assert.deepEqual(event.evidenceIds, ["js72qter4vn9cx1bxqw045jtf17yg6t4"]);
  assert.match(event.description, /162 Thai nationals/u);
  assert.match(event.description, /held in Siem Reap/u);
  assert.match(event.description, /six had outstanding cases/u);
});
