import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 30 ceasefire benchmark keeps the drone dispute attributed and removes unrelated return-policy copy", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7fmsaesjnnk6skya4500n465812e9b");

  assert.ok(event);
  assert.equal(event.date, "2025-12-30");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /72-Hour Ceasefire Benchmark/u);
  assert.match(event.description, /at noon on December 30/u);
  assert.match(event.description, /Thailand said/u);
  assert.match(event.description, /alleged Cambodian drones/u);
  assert.match(event.description, /Cambodia denied the drone allegation/u);
  assert.match(event.description, /18 detained Cambodian soldiers/u);
  assert.doesNotMatch(event.description, /O'Smach|asymmetrical return/iu);
  assert.match(event.descriptionTh, /18/u);
  assert.match(event.descriptionKh, /18/u);
  assert.deepEqual(event.evidenceIds, [
    "js73dmc742knhvwwvvtfh24asn7y9y7e",
    "jn78e99cjv9afpkftya663dag57y8k5x",
  ]);
});
