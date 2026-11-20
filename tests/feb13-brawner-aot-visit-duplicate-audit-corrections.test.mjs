import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks715vbmxsp78sqp9w9xggkmfx812pdy";
const mergedId = "ks77s79phdtv4w23mm2800xq5n8164w6";
const akpBriefingId = "96ebb2ea06693b27234a20b6f00d61a1";
const akpBorderId = "f0e9984b86335115d67983de09551b92";
const khmerTimesId = "jn7630qres1pq5czqnyvmra3j58178gg";

test("Brawner AOT and border inspection is one February 13 event", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-13");
  assert.equal(event.timeOfDay, "10:00");
  assert.equal(timeline.some((row) => row.id === mergedId), false);
  assert.match(event.description, /At 10:00 he visited CLG TS-2/u);
  assert.match(event.description, /at 14:05 he observed/u);
  assert.match(event.description, /occurred on February 13, not February 16/u);
  assert.deepEqual(event.evidenceIds, [akpBriefingId, akpBorderId, khmerTimesId]);
});

test("territorial characterisations from the Cambodian-hosted visit remain attributed", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /territorial characterisations presented during the visit are Cambodia's claims/u);
  assert.match(event.descriptionTh, /เป็นข้อกล่าวหาของฝ่ายกัมพูชา/u);
  assert.match(event.descriptionKh, /គឺជាការអះអាងរបស់កម្ពុជា/u);
  assert.doesNotMatch(event.descriptionTh, /[\u0590-\u05ff]/u);
});

test("all three Cambodian Defence Ministry-derived reports share one provenance chain", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const rows = [akpBriefingId, akpBorderId, khmerTimesId].map((id) => articles.find((row) => row.id === id));
  for (const row of rows) {
    assert.ok(row);
    assert.equal(row.provenanceId, "cambodia-mod-feb13-brawner-banteay-meanchey-visit");
  }
  const khmerTimes = rows[2];
  assert.match(khmerTimes.summary, /visit ran from February 11 to 14/u);
  assert.match(khmerTimes.summary, /Friday, February 13/u);
  assert.match(khmerTimes.summary, /14:05/u);
});

test("the retained event no longer relies on the unusable Kiripost citation", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.evidenceIds.includes("k9764rngnrhes32hnfvdvfhhm1812rxe"), false);
});
