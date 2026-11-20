import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("April 21 MOU 44 preview keeps the source-backed interview time and stays separate from the NSC decision", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === "ks769spcsagwhv8nh6jrjzgj2s858e46");

  assert.ok(event);
  assert.equal(event.date, "2026-04-21");
  assert.equal(event.timeOfDay, "09:40");
  assert.match(event.description, /pre-meeting policy statement/u);
  assert.match(event.description, /NSC decision came later, on April 23/u);
  assert.deepEqual(event.evidenceIds, [
    "f11df4edbd87e3977af246f6251928c9",
    "js7ccfjdw9zpjns0rgxq2axasd858an0",
  ]);
  assert.ok(timeline.some((row) => row.id === "ks76kr499qfbggq173g3z09rts85gmk7" && row.date === "2026-04-23"));
});
