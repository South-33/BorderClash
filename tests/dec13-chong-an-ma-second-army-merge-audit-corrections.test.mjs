import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7dzx2cghd9hzvxq0spr14gss8125ws";
const duplicateId = "ks750gfn0jgefkt5efvbj7yfqn812fra";
const js100Id = "6391f65d2baaadfb973d9845d1866588";
const nationId = "c9e3504b538cc4ae4d65226cf88c0ff1";
const bangkokPostId = "js74b9m9s89gv9y53tv809rxp97x66gj";
const provenanceId = "thai-second-army-dec13-1100-briefing";

test("legacy Dec 14 recapture row is corrected to the Dec 13 Second Army briefing", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "11:00");
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.deepEqual(event.evidenceIds, [js100Id]);
  assert.match(event.title, /Sam Tae and Hill 677 Seized/u);
  assert.doesNotMatch(event.title, /Recapture Chong Arn Ma/u);
});

test("surviving copy preserves ongoing operations and mine-notebook attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /military operations were still continuing/u);
  assert.match(event.description, /11 mine or IED points totaling 30 devices/u);
  assert.match(event.description, /two TNT IED points totaling six devices/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /tactical victory/u);
});

test("Thai and Khmer copy preserve date, time, counts, and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const value of ["11:00", "11", "30", "2", "6", "12", "21"]) {
    assert.ok(event.descriptionTh.includes(value), value);
    assert.ok(event.descriptionKh.includes(value), value);
  }
  assert.match(event.descriptionTh, /ยังไม่ได้รับการยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /មិនទាន់ត្រូវបានផ្ទៀងផ្ទាត់ដោយឯករាជ្យ/u);
});

test("reports from the Dec 13 11:00 Second Army briefing share provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  for (const id of [js100Id, nationId, bangkokPostId]) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId, id);
  }
});
