import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 10 humanitarian snapshot cites the two records that actually support its figures", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks7abq6j10b59wazewh66ymc3d812ztk");
  const ministry = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "1387f64b5e3cafa121066e40bdfb4368");
  assert.ok(event);
  assert.ok(ministry);
  assert.equal(event.date, "2025-12-10");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /more than 500,000 people/u);
  assert.match(event.description, /as of 08:30, 1,168 educational institutions/u);
  assert.deepEqual(event.evidenceIds, [
    "k97cekhyv05pp558smrd6tky6x7xepqv",
    "1387f64b5e3cafa121066e40bdfb4368",
  ]);
  assert.doesNotMatch(event.description, /514,000|remain displaced/iu);
  assert.match(ministry.summary, /as of 08:30/u);
  assert.match(ministry.summary, /1,168 educational institutions/u);
});
