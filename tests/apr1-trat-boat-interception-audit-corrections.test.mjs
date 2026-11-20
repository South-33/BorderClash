import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7078bcp2p9bnv73xts7n0tss8437xh";
const evidenceId = "c9a6207b02129c9eeab186d0c29ae0c9";
const row = () => readFileSync("data/timeline/2026-04.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Apr 1 Trat boat interception uses captured event date and time window", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2026-04-01");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /between 21:00 and 22:00 on April 1/u);
  assert.doesNotMatch(event.description, /6,000 liters/u);
  assert.doesNotMatch(event.description, /not an exact event time|unsupported|audit/u);
  assert.match(event.descriptionTh, /[ก-๙]/u);
  assert.match(event.descriptionKh, /[ក-៝]/u);
});
