import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Dec 24 cluster-munition row preserves the Cambodian ministry attribution", () => {
  const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8")
    .trim()
    .split(/\r?\n/u)
    .map(JSON.parse);
  const event = rows.find((item) => item.id === "ks73teymmv4e8604e9pqrdwvpn813tcq");

  assert.equal(event.date, "2025-12-24");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["3fc2c3ce32667e414f1a15871a68cb60"]);
  assert.match(event.title, /Alleges/u);
  assert.match(event.description, /between 12:15 and 12:26/u);
  assert.match(event.description, /Cambodian Defence Ministry allegations/u);
  assert.match(event.description, /does not independently verify/u);
  assert.doesNotMatch(event.description, /Feb 25|government later clarified|banned cluster/u);
});
