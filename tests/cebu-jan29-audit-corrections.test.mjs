import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Cebu border discussion is one January 29 milestone, not Jan 30/31 publication-date rows", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7bnjb8hwx0e30sy1m7eg7dp1813pes");
  const news = readJsonl("data/news/2026-01.jsonl");
  const akp = news.find((row) => row.id === "22a03b0ace948fb0a4a6d7bb2f014528");
  const singapore = news.find((row) => row.id === "f149d935460b770c365f03348d013ed2");

  assert.ok(event);
  assert.ok(akp);
  assert.ok(singapore);
  assert.equal(event.date, "2026-01-29");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(timeline.some((row) => row.id === "ks751tfccadzx62wbghnf81ays813xv7"), false);
  assert.match(event.description, /Cambodia's account/u);
  assert.match(event.description, /full and effective implementation/u);
  assert.match(event.description, /ASEAN Observer Team/u);
  assert.doesNotMatch(`${event.title} ${event.description}`, /ASEAN intervention/iu);
  assert.deepEqual(event.evidenceIds, [akp.id, singapore.id, "jn78c180vn7an5de203ytkcn6d809wy3"]);
  assert.match(akp.summary, /previous day, January 29/u);
  assert.match(singapore.summary, /January 28 to 29, 2026/u);
});
