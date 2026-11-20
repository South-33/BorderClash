import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const retainedId = "ks7f450ekeeqs9pg6312ahn1r1812j9m";
const duplicateId = "ks7b66ew807c668wpg9hqtths98128z9";
const capturedEvidenceId = "js76m6j8595k8rryksctbcm8y97y1me9";

test("Dec 26 three-soldier casualty report is one attributed Sa Kaeo event", () => {
  const rows = readJsonl("data/timeline/2025-12.jsonl");
  const event = rows.find((row) => row.id === retainedId);

  assert.ok(event);
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.importance, 74);
  assert.match(event.title, /First Army Reports Three Soldiers Killed at Ban Nong Chan/u);
  assert.match(event.description, /about 17:00/u);
  assert.match(event.description, /Sa Kaeo/u);
  assert.match(event.description, /Thai military's account/u);
  assert.doesNotMatch(event.description, /17 others|Surin|21:00/u);
  assert.deepEqual(event.evidenceIds, [capturedEvidenceId]);
  assert.equal(rows.some((row) => row.id === duplicateId), false);
});

test("Thai and Khmer descriptions preserve location and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === retainedId);
  assert.ok(event);
  assert.match(event.descriptionTh, /จังหวัดสระแก้ว/u);
  assert.match(event.descriptionTh, /รายงานของกองทัพไทย/u);
  assert.match(event.descriptionKh, /ខេត្ត Sa Kaeo/u);
  assert.match(event.descriptionKh, /ការរាយការណ៍របស់យោធាថៃ/u);
});

test("Naewna summary stays within the captured publisher text", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === capturedEvidenceId);
  assert.ok(article);
  assert.match(article.summary, /one non-commissioned officer and two privates/u);
  assert.match(article.summary, /about 17:00/u);
  assert.match(article.summary, /Ban Nong Chan/u);
  assert.doesNotMatch(article.summary, /Pongsakorn|Patiphat|Tiwtawan/u);
});
