import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("3.5 billion baht defence allocation is anchored to the September 22 minister statement", () => {
  const september = readJsonl("data/timeline/2026-09.jsonl");
  const october = readJsonl("data/timeline/2026-10.jsonl");
  const event = september.find((row) => row.id === "ks72v86cbp4k7myfmafycf6rcx8hjk66");
  assert.ok(event);
  assert.equal(event.date, "2026-09-22");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Defence Minister Says Government Approved/u);
  assert.match(event.description, /replace equipment already used/u);
  assert.match(event.description, /did not tie this allocation to specific HIMARS/u);
  assert.deepEqual(event.evidenceIds, [
    "3ae5a01808174ff2873c5ce3f734a4f2",
    "js75aagtggnba76kmt8msc0nvd8ftfy3",
  ]);
  assert.equal(october.some((row) => row.id === event.id), false);
});

test("September and October reports share the underlying Adul budget-statement provenance", () => {
  const septemberNews = readJsonl("data/news/2026-09.jsonl");
  const octoberNews = readJsonl("data/news/2026-10.jsonl");
  const siamRath = septemberNews.find((row) => row.id === "3ae5a01808174ff2873c5ce3f734a4f2");
  const nation = octoberNews.find((row) => row.id === "js75aagtggnba76kmt8msc0nvd8ftfy3");
  assert.ok(siamRath);
  assert.ok(nation);
  assert.equal(siamRath.provenanceId, "adul-defense-council-sep22-budget");
  assert.equal(nation.provenanceId, "adul-defense-council-sep22-budget");
  assert.match(siamRath.summary, /On September 22/u);
});
