import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Hill 500 missile record preserves the early LR misidentification and later GAM-102 correction", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks740445e156y8w2mwbsjaqbq5812596");
  const official = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "ffaac12d64b07ce707cd130da67005f8");
  assert.ok(event);
  assert.ok(official);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /GAM-102 Missiles/u);
  assert.match(event.description, /Early reporting identified the weapons as GAM-102LR/u);
  assert.match(event.description, /corrected the identification to GAM-102/u);
  assert.match(event.description, /older production lot/u);
  assert.doesNotMatch(event.description, /recent Chinese delivery|expanding arms pipeline/iu);
  assert.deepEqual(event.evidenceIds, [
    "k97ekreptdk7kz94390mg6798x7xev7t",
    "ffaac12d64b07ce707cd130da67005f8",
  ]);
  assert.match(official.summary, /GAM-102 anti-tank guided missile, not the GAM-102LR/u);
  assert.match(official.summary, /older production lot/u);
});
