import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const noteId = "ks7atw3w8b66vzm2td75s8kh11812y92";
const delayId = "ks78gzcyw1t9swj2z2vhptm9vs813bzf";
const akpId = "jn767nvyhjgqjwmbx13bt0kjhs7z6v9c";

test("Jan 13 Cambodian boundary-survey note is date-only and uses the supported pillar ranges", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const note = timeline.find((row) => row.id === noteId);
  assert.ok(note);
  assert.equal(note.date, "2026-01-13");
  assert.equal(note.timeOfDay, "");
  assert.match(note.title, /Jan\. 13 Note Proposes Resuming Joint Boundary Surveys/u);
  assert.match(note.description, /Boundary Pillars 42-47 and 52-59/u);
  assert.match(note.description, /Jan\. 19-23/u);
  assert.match(note.description, /Jan\. 26-30/u);
  assert.match(note.description, /15 boundary pillars/u);
  assert.doesNotMatch(note.description, /57-59|Jan\. 19-30/u);
  assert.deepEqual(note.evidenceIds, [akpId]);
});

test("Jan 13 note stays aligned in Thai and Khmer", () => {
  const note = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === noteId);
  assert.ok(note);
  assert.match(note.titleTh + note.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(note.titleKh + note.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [note.descriptionTh, note.descriptionKh]) {
    assert.match(text, /42-47/u);
    assert.match(text, /52-59/u);
    assert.match(text, /19-23/u);
    assert.match(text, /26-30/u);
    assert.match(text, /15/u);
    assert.doesNotMatch(text, /57-59|\?|�/u);
  }
});

test("Jan 14 postponement row no longer duplicates the Jan 13 survey-note details", () => {
  const delay = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === delayId);
  assert.ok(delay);
  assert.equal(delay.date, "2026-01-14");
  assert.match(delay.description, /second postponement/u);
  assert.match(delay.description, /new Thai JBC composition/u);
  assert.doesNotMatch(delay.description, /42-47|52-59|January 19|January 30|Jan\. 13 note/u);
  assert.doesNotMatch(delay.descriptionTh, /42-47|52-59|19-30/u);
  assert.doesNotMatch(delay.descriptionKh, /42-47|52-59|19.*30/u);
});
