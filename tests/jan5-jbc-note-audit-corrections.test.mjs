import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 5 row is the JBC Note Verbale rather than later occupation reporting", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7590c82v3egj5qajrzrdjnm98136vy");
  assert.ok(event);
  assert.equal(event.date, "2026-01-05");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "diplomatic");
  assert.equal(event.importance, 76);
  assert.match(event.title, /Re-Proposes Special JBC Meeting/u);
  assert.match(event.description, /sent a Note Verbale/u);
  assert.match(event.description, /Those alleged violations remain Cambodia's claims/u);
  assert.doesNotMatch(event.description, /4,000 families|Prak Sokhonn|risks the December 27 ceasefire/iu);
  assert.deepEqual(event.evidenceIds, [
    "012c348a909f4d58b21c788df01ac198",
    "k9783rn4hgwztg6xqx5gfvp4458020rx",
  ]);

  for (const id of event.evidenceIds) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-ssba-jan5-jbc-note");
  }
});
