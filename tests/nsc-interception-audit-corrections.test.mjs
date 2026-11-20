import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 16 NSC record stops at the approved interception measure", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks7cszhhef8dt9vkcn61gvztt1812121");
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /National Security Council resolved to block shipments/u);
  assert.match(event.description, /coordinated through the Thai Maritime Enforcement Command Center/u);
  assert.match(event.description, /not a fully implemented Gulf blockade/u);
  assert.doesNotMatch(event.description, /drone threats|GPS jamming|fully implemented the blockade/iu);
  assert.deepEqual(event.evidenceIds, [
    "js74zezjmsvrgybs4q1m16b15n7xdts9",
    "js790kxvjz80wm77f9h0h7nexs7xcvck",
  ]);
});
