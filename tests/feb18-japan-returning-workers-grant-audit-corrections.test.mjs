import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks706g8bzf2rbtvy1s1c9m4q8x81g4r0";
const freshId = "jn77cp3y8jbmasf21hc8czx4w181hty6";
const embassyId = "e24c56682a4ab5ea25de980687abdd04";
const provenanceId = "japan-ilo-returning-workers-grant-2026-02-18";

test("Japan returning-workers grant uses the embassy announcement date, not the republication date", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-18");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /ILO Grant for Returning Cambodian Workers/u);
  assert.match(event.description, /International Labour Organization/u);
  assert.match(event.description, /Preah Vihear, Oddar Meanchey and Pursat/u);
  assert.doesNotMatch(event.description, /forced to return|2025-2026 hostilities/iu);
  assert.deepEqual(event.evidenceIds, [freshId, embassyId]);
});

test("Fresh News uses its article URL and shares the embassy statement provenance", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const fresh = articles.find((row) => row.id === freshId);
  const embassy = articles.find((row) => row.id === embassyId);
  assert.ok(fresh);
  assert.ok(embassy);
  assert.equal(fresh.sourceUrl, "https://english.freshnews.com.kh/localnews/68176-2026-02-19-04-33-54.html");
  assert.equal(fresh.provenanceId, provenanceId);
  assert.equal(embassy.provenanceId, provenanceId);
  assert.equal(embassy.credibility, 100);
  assert.match(fresh.summary, /returning from Thailand due to the border conflict/u);
});
