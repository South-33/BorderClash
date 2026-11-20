import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("July 5 border blast uses the source-backed time and preserves unresolved cause", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl")
    .find((row) => row.id === "ks7esx1e0jft1tjacavdnth73s8b5510");
  const primary = readJsonl("data/news/2026-07.jsonl")
    .find((row) => row.id === "31c427147bc07f2d9e4a10aff45fea94");

  assert.ok(event);
  assert.ok(primary);
  assert.equal(event.date, "2026-07-05");
  assert.equal(event.timeOfDay, "12:35");
  assert.match(event.description, /approximately 12:35/u);
  assert.match(event.description, /cause was under investigation/u);
  assert.match(event.description, /No independent evidence/u);
  assert.doesNotMatch(event.description, /Thai forces caused the blast/iu);
  assert.deepEqual(event.evidenceIds, [
    primary.id,
    "js70n7csc8s5wfk7xd56v1qh9d8a2462",
  ]);
  assert.match(primary.summary, /approximately 12:35 p\.m\./u);
  assert.match(primary.summary, /cause was under investigation/u);
});
