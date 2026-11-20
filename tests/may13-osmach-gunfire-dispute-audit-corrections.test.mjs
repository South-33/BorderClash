import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78sp8k0nw58y5kb84ks2r2fh873jfy";
const oldThaiPbsId = "js7dg2vncws8fvhn9srpefxwe1873mab";
const thaiPbsWorldId = "ccc58636808bd57d547fb19fb0edc017";
const cambodiaDenialId = "7b63ec64b9f24f508eed54bb6882ed2b";

test("May 13 O'Smach gunfire record uses the supported 18:40 time and preserves the dispute", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-13");
  assert.equal(event.timeOfDay, "18:40");
  assert.match(event.title, /Thai Army Reports 11 Shots/u);
  assert.match(event.title, /Cambodia Denies/u);
  assert.match(event.description, /Thai troops heard 11 small-arms shots from the Cambodian side/u);
  assert.match(event.description, /did not return fire/u);
  assert.match(event.description, /Cambodia's Defence Ministry categorically denied/u);
  assert.match(event.description, /remains disputed/u);
  assert.doesNotMatch(event.description, /fired 11 rifle shots into Thai territory/u);
  assert.deepEqual(event.evidenceIds, [thaiPbsWorldId, cambodiaDenialId]);
});

test("Thai and Khmer versions preserve time, shot count, denial and uncertainty", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /18:40/u);
    assert.match(event[field], /11/u);
  }
  assert.match(event.descriptionTh, /ปฏิเสธ/u);
  assert.match(event.descriptionKh, /បដិសេធ/u);
});

test("captured Thai and Cambodian evidence are separate source chains", () => {
  const articles = readJsonl("data/news/2026-05.jsonl");
  const oldThaiPbs = articles.find((row) => row.id === oldThaiPbsId);
  const thaiPbsWorld = articles.find((row) => row.id === thaiPbsWorldId);
  const cambodia = articles.find((row) => row.id === cambodiaDenialId);
  assert.ok(oldThaiPbs);
  assert.ok(thaiPbsWorld);
  assert.ok(cambodia);
  assert.equal(oldThaiPbs.status, "archived");
  assert.equal(oldThaiPbs.provenanceId, "thai-army-may13-osmach-gunfire-report");
  assert.equal(thaiPbsWorld.provenanceId, "thai-army-may13-osmach-gunfire-report");
  assert.equal(cambodia.provenanceId, "cambodia-mod-may13-osmach-gunfire-denial");
  assert.match(thaiPbsWorld.summary, /18:40/u);
  assert.match(cambodia.summary, /categorically denying/u);
});
