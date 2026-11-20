import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7ft8d33e40fsnfrja9ezp5m982rf0m";
const primaryId = "11596c094e91411a395e53b45b8259ba";
const kiripostId = "jn73111xe8cvah6p5d7bttvjq982rxv6";

test("Cambodian-worker policy milestone uses the March 9 ministerial statement date", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-09");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [primaryId, kiripostId]);
  assert.match(event.title, /Reaffirms No New Cambodian Worker Admissions/u);
});

test("timeline distinguishes an existing policy reaffirmation from a new March 11 ban", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /reaffirmed the government's existing position/u);
  assert.match(event.description, /no new Cambodian workers would be admitted/u);
  assert.match(event.description, /existing workers' stays remained under consideration/u);
  assert.match(event.description, /not a new ban announced on March 11/u);
  assert.match(event.descriptionTh, /ย้ำจุดยืนเดิมของรัฐบาล/u);
  assert.match(event.descriptionKh, /បញ្ជាក់ឡើងវិញនូវគោលជំហរដែលមានស្រាប់/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("primary and derivative evidence share the March 9 ministerial provenance", () => {
  const articles = readJsonl("data/news/2026-03.jsonl");
  const primary = articles.find((row) => row.id === primaryId);
  const kiripost = articles.find((row) => row.id === kiripostId);
  assert.ok(primary);
  assert.ok(kiripost);
  assert.equal(primary.source, "Ministry of Labour of Thailand");
  assert.equal(primary.credibility, 90);
  assert.equal(primary.provenanceId, "mar9-labour-cambodian-worker-policy");
  assert.equal(kiripost.provenanceId, primary.provenanceId);
  assert.match(primary.summary, /on March 9/u);
  assert.match(kiripost.summary, /reaffirmed Thailand's position/u);
});
