import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks797p0y348mbt6rhyc4tf639x813hxt";
const primaryId = "545896586ff3513bdc2c0b4423255743";
const khmerTimesId = "k973gqz2f0fdgn10vz30tfgfed7z5xna";

test("Jan 13 border-position event is date-only and anchored to Pen Bona's statement", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-13");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Will Not Recognise Border Changes by Force/u);
  assert.match(event.description, /Pen Bona reiterated/u);
  assert.match(event.description, /would not recognise any alteration/u);
  assert.match(event.description, /does not support an exact event time/u);
  assert.deepEqual(event.evidenceIds, [primaryId, khmerTimesId]);
});

test("four-province fortification claims remain attributed and Thailand's denial is preserved", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Cambodian allegations/u);
  for (const province of ["Oddar Meanchey", "Preah Vihear", "Banteay Meanchey", "Pursat"]) {
    assert.match(event.description, new RegExp(province, "u"));
  }
  assert.match(event.description, /bunkers or strongholds/u);
  assert.match(event.description, /Thailand's Foreign Ministry rejected the occupation claim/u);
  assert.doesNotMatch(event.description, /building bunkers in Oddar Meanchey, Preah Vihear, Banteay Meanchey, and Pursat/u);
});

test("English, Thai and Khmer preserve attribution and the lack of exact time", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /ข้อกล่าวหาของกัมพูชา/u);
  assert.match(event.descriptionTh, /ประเทศไทยปฏิเสธข้อกล่าวหา/u);
  assert.match(event.descriptionTh, /ไม่รองรับเวลาเกิดเหตุที่แน่นอน/u);
  assert.match(event.descriptionKh, /ការចោទប្រកាន់របស់កម្ពុជា/u);
  assert.match(event.descriptionKh, /ថៃបានបដិសេធ/u);
  assert.match(event.descriptionKh, /មិនគាំទ្រម៉ោងព្រឹត្តិការណ៍ជាក់លាក់/u);
});

test("evidence registry distinguishes the government primary source from Khmer Times reporting", () => {
  const articles = readJsonl("data/news/2026-01.jsonl");
  const primary = articles.find((row) => row.id === primaryId);
  const khmerTimes = articles.find((row) => row.id === khmerTimesId);
  assert.ok(primary);
  assert.ok(khmerTimes);
  assert.equal(primary.provenanceId, "cambodia-government-jan13-border-force-position");
  assert.match(primary.summary, /did not itself substantiate specific territorial-control or fortification allegations/u);
  assert.equal(khmerTimes.source, "Khmer Times");
  assert.match(khmerTimes.summary, /Thai forces occupied areas/u);
  assert.match(khmerTimes.summary, /Thailand's Foreign Ministry rejected the occupation claim/u);
  assert.match(khmerTimes.summary, /about 490,000 of more than 640,000 displaced people had returned home/u);
});
