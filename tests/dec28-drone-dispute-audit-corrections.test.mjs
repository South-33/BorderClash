import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 28 drone row separates the allegation from later casualty reporting", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks78sdzfa2wkhvcrshrsv9btqs813z64");
  assert.ok(event);
  assert.equal(event.date, "2025-12-28");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Thailand Reports 250\+ Drones/u);
  assert.match(event.description, /On December 29/u);
  assert.match(event.description, /night of December 28/u);
  assert.match(event.description, /Cambodia's Defence Ministry denied/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /42 Thai soldiers|merit-making|January 13|one million/iu);
  assert.deepEqual(event.evidenceIds, [
    "8cdaf08aecd0770bef883c4a6f2689ff",
    "k97axsd16wwgyafzd8563pj1c57y6hme",
    "jn7cgwk8pp65m8qe2h486077ax7y9054",
  ]);

  for (const id of [
    "8cdaf08aecd0770bef883c4a6f2689ff",
    "js7cnmt8nytaf91cd95kkej49n7y63q8",
    "k97axsd16wwgyafzd8563pj1c57y6hme",
    "k97fzhfe92h56qhxf6ekz13awh7y9k0t",
    "k978hd35tkdtf569zm4ew7ycns7y9yxd",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "thai-army-dec29-250-drone-statement");
  }
  for (const id of [
    "jn7cgwk8pp65m8qe2h486077ax7y9054",
    "js72zt4nb6km3d161f34t8n85d7y9we7",
    "jn73m5289fcf78vhj0n0a52td17y8tv5",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-dec29-drone-denial");
  }
});
