import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const survivorId = "ks737cqqvp9v2nm9qh63aep05d82q9ff";
const duplicateId = "ks7fw7xtr05bd7c1jwqgmwd26d82xx9x";
const capturedEvidence = [
  "k977hh1ny78s32z1961tex26g982pgqk",
  "js7a0ksh2btzsg0e1vxvyk2zqn82q002",
  "js77yy0qnb5da0da2jrw0jz45582rfvy",
];

test("March 8 Chong Sam Tae warning-shot duplicates are merged without an invented time", () => {
  const rows = read("data/timeline/2026-03.jsonl");
  const event = rows.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(rows.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-03-08");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, capturedEvidence);
});

test("survivor attributes encroachment and discipline claims to the Thai Army", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  assert.match(event.title, /Thai Army Says/u);
  assert.match(event.description, /what the Army described as encroachment/u);
  assert.match(event.description, /These are Thai Army claims/u);
  assert.match(event.description, /do not independently establish/u);
  assert.match(event.description, /does not give an exact time|None of the captured reports gives an exact time/u);
});

test("Thai and Khmer copies retain attribution, date, and time uncertainty", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.match(value, /8/u);
  }
  assert.match(event.descriptionTh, /คำกล่าวของกองทัพไทย/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់កងទ័ពថៃ/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ដោយឯករាជ្យ/u);
});

test("captured reports from the same Army briefing share provenance", () => {
  const articles = read("data/news/2026-03.jsonl");
  const provenance = new Set(capturedEvidence.map((id) => articles.find((row) => row.id === id)?.provenanceId));
  assert.deepEqual([...provenance], ["thai-army-mar10-chong-sam-tae-briefing"]);
});
