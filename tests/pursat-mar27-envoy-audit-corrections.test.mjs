import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("March 27 Thmor Da envoy visit is one attributed milestone with relevant evidence", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === "ks7fkkj4c6b1vnz3t8dh4ffawd83ppaf");

  assert.ok(event);
  assert.equal(event.date, "2026-03-27");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(timeline.some((row) => row.id === "ks76yr6v87ss2vzj9bzgxdj4kn83rdm6"), false);
  assert.equal(timeline.some((row) => row.id === "ks7avvs7bps60ky2jr3k6xfzxs841war"), false);
  assert.match(event.description, /76 displaced families/u);
  assert.match(event.description, /Cambodia alleges/u);
  assert.match(event.description, /does not independently determine sovereignty/u);
  assert.deepEqual(event.evidenceIds, [
    "8d6314b441d19836698126988db3f553",
    "js7azmfrpfcvbjk92v79k3rhwn83rqmt",
  ]);
  assert.equal(event.evidenceIds.includes("k9748qatryvk4n1r7f00bpxzg183qh4a"), false);
});
