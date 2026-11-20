import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks79r18qt1q1xm6m4p458hmn458120pb";
const thaiRathId = "26a7799ff1f6f3fb6d245b069cf94f64";
const bangkokPostId = "js733vq7en3jvqp8rg5cfk05yn7y61p6";
const provenanceId = "thai-joint-press-centre-2025-12-28-1430";

test("Dec 28 row keeps the directly supported 14:30 Joint Press Centre briefing", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-28");
  assert.equal(event.timeOfDay, "14:30");
  assert.match(event.title, /Ceasefire Shifts Focus to Diplomacy/u);
  assert.match(event.description, /December 27 GBC ceasefire measures/u);
  assert.match(event.description, /IL-62M/u);
  assert.deepEqual(event.evidenceIds, [thaiRathId]);
});

test("aircraft monitoring is not promoted into an unsupported weapons claim", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /no immediate threat/u);
  assert.match(event.description, /do not establish that the aircraft carried weapons or violated the ceasefire/u);
  assert.doesNotMatch(event.description, /evacuees are returning/u);
  assert.doesNotMatch(event.description, /ensure no weapons violations/u);
});

test("Thai and Khmer preserve dates, time, aircraft type, and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["14:30", "28", "27", "IL-62M"]) {
    assert.ok(event.descriptionTh.includes(value), `Thai: ${value}`);
    assert.ok(event.descriptionKh.includes(value), `Khmer: ${value}`);
  }
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันว่าเครื่องบิน/u);
  assert.match(event.descriptionKh, /មិនបញ្ជាក់ថាយន្តហោះ/u);
});

test("same Joint Press Centre reports share provenance while timeline uses the captured source", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const thaiRath = articles.find((row) => row.id === thaiRathId);
  const bangkokPost = articles.find((row) => row.id === bangkokPostId);
  assert.ok(thaiRath);
  assert.ok(bangkokPost);
  assert.equal(thaiRath.provenanceId, provenanceId);
  assert.equal(bangkokPost.provenanceId, provenanceId);
  assert.match(thaiRath.summary, /14:30/u);
});
