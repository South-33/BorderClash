import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 8 airstrike milestone removes the reversed 30km claim and separates party chronologies", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7b63hwgmtzq11hqa8d955tsd813trh");
  assert.ok(event);
  assert.equal(event.date, "2025-12-08");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Thailand Confirms Airstrikes/u);
  assert.match(event.description, /Royal Thai Air Force said it struck military infrastructure/u);
  assert.match(event.description, /reported an F-16 strike at 09:05/u);
  assert.match(event.description, /Associated Press independently confirmed/u);
  assert.match(event.description, /four Cambodian civilians/u);
  assert.match(event.description, /about nine others/u);
  assert.doesNotMatch(event.description, /30 ?km|full-scale offensive/iu);
  assert.deepEqual(event.evidenceIds, [
    "k977fb57dq08rkabjt3rh7ag6d7x7tp6",
    "91184f4e7f15a8208f1c60e5d271edc8",
    "4ef0d275247be6b4ed30445d461f2f25",
  ]);
  for (const id of ["91184f4e7f15a8208f1c60e5d271edc8", "js7c32vyqsmaxyzhz9ve6ffp4x7x6fb5"]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "thai-rtaf-dec8-air-operations");
  }
  for (const id of ["4ef0d275247be6b4ed30445d461f2f25", "jn7enxv0gmmyajynt4nt0f129x7x4gbp"]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-dec8-border-attacks");
  }
  assert.match(news.find((row) => row.id === "k977fb57dq08rkabjt3rh7ag6d7x7tp6")?.summary || "", /about nine others/u);
});
