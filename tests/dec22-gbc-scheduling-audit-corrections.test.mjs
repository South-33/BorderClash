import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("December 22 GBC row records the agreement to convene, not the next-day venue dispute", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks79p7n982fm1vv6z0jbxey5g1813zbp");

  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Agree to Hold GBC Ceasefire Talks on Dec 24/u);
  assert.match(event.description, /Following the December 22 special ASEAN foreign ministers' meeting/u);
  assert.match(event.description, /venue.*December 23/iu);
  assert.doesNotMatch(event.title, /Venue Dispute/iu);
  assert.deepEqual(event.evidenceIds, [
    "k97b1mst908vdtz6y9m8khf9z17xtemk",
    "k97ca68krksxbfgyecky40jwvx7xt9jk",
  ]);
});
