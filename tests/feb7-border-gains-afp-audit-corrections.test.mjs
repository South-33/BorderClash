import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks79h718qmk0zyftrzxhs38vr5813nc6";
const cnaId = "jn78yd30gg90f36rs8swed94wx80psh5";
const starId = "49a43bd575cd55fb3dc8a4cf19bb1232";
const provenanceId = "afp-feb7-border-gains-villages";

test("Feb 7 row is an AFP field-report snapshot, not a newly dated territorial takeover", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-07");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /^AFP Documents Post-Ceasefire/u);
  assert.match(event.description, /published a field report/u);
  assert.match(event.description, /during the 2025 fighting/u);
  assert.match(event.description, /Phnom Penh said/u);
  assert.match(event.description, /Bangkok said/u);
  assert.match(event.description, /64 hectares at Klong Paeng in December/u);
  assert.match(event.description, /does not establish that territorial control was newly consolidated on February 7/u);
  assert.doesNotMatch(event.description, /established permanent control/u);
  assert.deepEqual(event.evidenceIds, [cnaId, starId]);
});

test("Thai and Khmer copies preserve disputed status and December chronology", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.descriptionTh, /ปี 2025/u);
  assert.match(event.descriptionTh, /64 เฮกตาร์/u);
  assert.match(event.descriptionTh, /ในเดือนธันวาคม/u);
  assert.match(event.descriptionKh, /ឆ្នាំ 2025/u);
  assert.match(event.descriptionKh, /64 ហិកតា/u);
  assert.match(event.descriptionKh, /ក្នុងខែធ្នូ/u);
});

test("CNA and The Star copies share the AFP field-report provenance", () => {
  const news = readJsonl("data/news/2026-02.jsonl");
  const cna = news.find((row) => row.id === cnaId);
  const star = news.find((row) => row.id === starId);
  assert.ok(cna);
  assert.ok(star);
  assert.equal(cna.provenanceId, provenanceId);
  assert.equal(star.provenanceId, provenanceId);
  assert.equal(cna.mediaEnvironment, "international");
  assert.equal(cna.category, "military");
  assert.match(cna.summary, /during the 2025 fighting/u);
  assert.match(cna.summary, /64 hectares at Klong Paeng had been reclaimed in December/u);
  assert.doesNotMatch(cna.summary, /moved the boundary line/u);
  assert.match(star.summary, /post-ceasefire conditions/u);
});
