import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const duplicateId = "ks7awd38kqaj2gj8y72q53j93584m18r";
const survivorId = "ks7da4wpv0d73m0ehenasdtsnd843p3k";

test("misdated OSmach barbed-wire wrapper is merged into the April 2 deployment event", () => {
  const march = readJsonl("data/timeline/2026-03.jsonl");
  const april = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(march.some((row) => row.id === duplicateId), false);
  const survivor = april.find((row) => row.id === survivorId);
  assert.ok(survivor);
  assert.equal(survivor.date, "2026-04-02");
  assert.equal(survivor.timeOfDay ?? "", "");
  assert.match(survivor.description, /O.Smach/u);
  assert.match(survivor.description, /around 70 personnel/u);
  assert.match(survivor.description, /two armored vehicles/u);
});
