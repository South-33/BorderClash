import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7fz0x1cqwc6jyfwxee0x0kds813gmk";
const akpId = "jn71bfd0hh0qtt9bce2bv8sa997yg9ac";
const annId = "k97bspkmr9gxnvj3r86va4yen17yerr8";

test("Jan 2 displacement row uses the directly supported 13:00 Defence Ministry update", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-02");
  assert.equal(event.timeOfDay, "13:00");
  assert.match(event.title, /Defence Ministry Says 393,600/u);
  assert.match(event.description, /more than 393,600 displaced people/u);
  assert.match(event.description, /more than 15,600 people had returned home/u);
  assert.deepEqual(event.evidenceIds, [akpId]);
  assert.equal(event.evidenceIds.includes(annId), false);
});

test("Jan 2 row does not conflate the separate half-million Interior Ministry report", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.doesNotMatch(event.title, /half a million/iu);
  assert.doesNotMatch(event.description, /512,263/u);
  assert.match(event.description, /Cambodian official reporting/u);
});

test("Thai and Khmer preserve time, counts, ceasefire date, and attribution", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["13:00", "393,600", "206,800", "126,000", "15,600", "27"]) {
    assert.ok(event.descriptionTh.includes(value), `Thai: ${value}`);
    assert.ok(event.descriptionKh.includes(value), `Khmer: ${value}`);
  }
  assert.match(event.descriptionTh, /ข้อมูลจากทางการกัมพูชา/u);
  assert.match(event.descriptionKh, /ព័ត៌មានពីអាជ្ញាធរកម្ពុជា/u);
});
