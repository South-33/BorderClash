import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks71tb6w5c7v0fs4vc9ks3ths18134e0";
const oldEvidenceId = "js7dfpbyxw58rec86s7b6h1vpd7xsv1x";
const evidenceId = "ba3a9aa13f3efdfe43a8ab0582058149";
const provenanceId = "thai-rath-ban-wang-mon-highrise-report-2025-12-22";

test("Dec 22 Ban Wang Mon report is date-only and explicitly attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /^Thai Media Reports/u);
  assert.doesNotMatch(event.title, /Snipers Occupy/u);
  assert.match(event.description, /Thai Headlines, translating a Thai Rath report/u);
});

test("report time is not promoted to an event time and source limits are explicit", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /timestamped 11:54/u);
  assert.match(event.description, /does not establish the exact time/u);
  assert.match(event.description, /does not name the underlying military source/u);
  assert.match(event.description, /less than 1 km/u);
});

test("Thai and Khmer preserve attribution, distance and time uncertainty", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of ["22", "1", "11:54"]) {
    assert.ok(event.descriptionTh.includes(value), `Thai ${value}`);
    assert.ok(event.descriptionKh.includes(value), `Khmer ${value}`);
  }
  assert.match(event.descriptionTh, /รายงาน/u);
  assert.match(event.descriptionKh, /រាយការណ៍/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันเวล/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ពីពេលវេលា/u);
});

test("captured mirror and blocked Thai Rath row share one provenance chain", () => {
  const rows = readJsonl("data/news/2025-12.jsonl");
  const mirror = rows.find((row) => row.id === evidenceId);
  const thaiRath = rows.find((row) => row.id === oldEvidenceId);
  assert.ok(mirror);
  assert.ok(thaiRath);
  assert.equal(mirror.provenanceId, provenanceId);
  assert.equal(thaiRath.provenanceId, provenanceId);
  assert.equal(mirror.credibility, 50);
  assert.match(mirror.summary, /11:54/u);
  assert.match(mirror.summary, /not independent corroboration/u);
});
