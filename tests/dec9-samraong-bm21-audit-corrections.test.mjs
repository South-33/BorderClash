import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7dtgd7pyzycycjp7anc4y2s9813x6x";
const evidenceId = "8dae19b62565f549b9e84c91bafe9ddb";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Samraong BM-21 strike is dated to Dec 9 and grounded in captured Thai PBS reporting", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2025-12-09");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /2nd Army/u);
  assert.match(event.description, /GBU-12 Paveway II/u);
  assert.match(event.description, /Samraong/u);
});

test("Samraong strike keeps target and damage claims attributed and removes unrelated gas framing", () => {
  const event = row();
  assert.match(event.description, /attributed to the Thai military/u);
  assert.match(event.description, /no exact strike time/u);
  assert.doesNotMatch(event.description, /chemical|toxic gas/iu);
});
