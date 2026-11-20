import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7dxfrypmqzwe6vpkf39fncgs813cy4";
const expectedEvidenceIds = [
  "jn7eqba2dsj8vvgx4rb768zhhx7y1a6q",
  "jn7946cmy6jn77xfexjzkvr8qs7y04gj",
  "jn7dcq995660yxetvdwfk4a32x7y1e6s",
];

test("Rubio-Hun Manet call keeps the Dec 25 date and drops the unsupported exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, expectedEvidenceIds);
  assert.match(event.description, /Rubio spoke by phone with Cambodian Prime Minister Hun Manet/u);
  assert.match(event.description, /US readout said Rubio expressed concern/u);
  assert.match(event.description, /Hun Manet said the call focused/u);
});

test("Rubio call is no longer conflated with the separate Dec 22 GBC-letter dispute", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.description, event.descriptionTh, event.descriptionKh]) {
    assert.doesNotMatch(text, /misinterpret|mischaracter|requested a truce|ขอหยุดยิงก่อน|បដិសេធព័ត៌មាន/u);
  }
});

test("Thai and Khmer copy preserve the date, actors and ceasefire attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /25 ธันวาคม/u);
  assert.match(event.descriptionTh, /รูบิโอ/u);
  assert.match(event.descriptionTh, /ฮุน มาเนต/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 25 ខែធ្នូ/u);
  assert.match(event.descriptionKh, /Rubio/u);
  assert.match(event.descriptionKh, /ហ៊ុន ម៉ាណែត/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.doesNotMatch(text, /���|\?{3,}/u);
  }
});
