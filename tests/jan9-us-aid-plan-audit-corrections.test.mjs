import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks75bs9atng6nhnyakhhz4gz25813v33";
const evidenceId = "826b5163952765298041a166a3177911";
const row = () => readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Jan 9 U.S. assistance plan uses captured AKP announcement", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2026-01-09");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /\$15 million/u);
  assert.match(event.description, /\$10 million/u);
  assert.match(event.description, /\$20 million/u);
});

test("Jan 9 U.S. assistance plan preserves package status", () => {
  const event = row();
  assert.match(event.description, /still under discussion/u);
  assert.match(event.description, /no exact event time/u);
});
