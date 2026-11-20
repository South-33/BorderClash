import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks72j0ak7cm7mas131n6m9r93h812avn";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(String.fromCharCode(10)).map(JSON.parse).find((r) => r.id === id);

test("Dec 13 Prey Chan row uses the captured AKP time window", () => {
  const event = row();
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["a89f2f41d87267d0738d8865ff1cdff0"]);
  assert.match(event.description, /between 16:00 and 16:10/u);
  assert.match(event.description, /Cambodian official claims/u);
  assert.doesNotMatch(event.title + " " + event.description, /toxic gas|toxic-gas|14:22/u);
});
