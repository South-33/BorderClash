import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("April 4 Ream corvette milestone is date-only and bounded to the supported arrival/induction chronology", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === "ks78ebwd53t5ggsy2y30r1gbf9849v43");
  assert.ok(event);
  assert.equal(event.date, "2026-04-04");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Janes later assessed the arrival date from historical satellite imagery/u);
  assert.match(event.description, /April 8 showed ceremonial dressing lines/u);
  assert.doesNotMatch(event.description, /advanced anti-ship and air-defense capabilities/u);
  assert.deepEqual(event.evidenceIds, [
    "481c58b27eea9dbd4f47ebc9ad775914",
    "16f8aeae1e19614c3fa20c344e0ab5a6",
  ]);
});

test("Ream Thai-source chain corrects the second-ship year and shares provenance", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const nationTv = news.find((row) => row.id === "js7cmq6v3cwa38nxc0hb3ye74n849s7v");
  const nationThailand = news.find((row) => row.id === "16f8aeae1e19614c3fa20c344e0ab5a6");
  const janes = news.find((row) => row.id === "481c58b27eea9dbd4f47ebc9ad775914");
  assert.ok(nationTv);
  assert.ok(nationThailand);
  assert.ok(janes);
  assert.equal(nationTv.provenanceId, "thai-navy-ream-corvette-apr4");
  assert.equal(nationThailand.provenanceId, "thai-navy-ream-corvette-apr4");
  assert.match(nationTv.summary, /June 2026/u);
  assert.doesNotMatch(nationTv.summary, /June 2024/u);
  assert.match(janes.summary, /historical satellite imagery/u);
});
