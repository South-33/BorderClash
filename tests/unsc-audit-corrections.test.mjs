import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Cambodia UN Security Council statement keeps border-local date without invented exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks73jxcv2xrnndycarvw9c4h75813hnf");
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /December 15 open debate in New York/u);
  assert.match(event.description, /December 16 in UTC\+07/u);
  assert.match(event.description, /He said Thai strikes had reached up to 90 km/u);
  assert.doesNotMatch(event.description, /90 km deep incursions/iu);
});
