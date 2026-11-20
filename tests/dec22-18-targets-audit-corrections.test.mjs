import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks77v1cwvmwfqpzh6ennn48sds8125xb";
const militaryId = "js78crgynsg6hcbkbxznvtk1ss7xt16s";
const mismatchedId = "js7a1q6szjqxns6aqaxp9h0rbn7xvaq7";
const provenanceId = "thai-2nd-army-situation-summary-2025-12-22";

test("18-target military row is dated to the Dec 22 situation, not publication day", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [militaryId]);
  assert.match(event.title, /Dec 22/u);
  assert.match(event.description, /source was published on December 23/u);
});

test("battlefield details remain Thai military claims and avoid causal overstatement", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /2nd Army Area said/u);
  assert.match(event.description, /at least 18 Cambodian military targets/u);
  assert.match(event.description, /BM-21 rockets and artillery/u);
  assert.match(event.description, /at least four Cambodian tanks/u);
  assert.match(event.description, /Thai military's account of disputed battlefield activity/u);
  assert.doesNotMatch(event.description, /strike was a response/u);
});

test("Thai and Khmer copies preserve date, count and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of ["22", "18", "4"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /รายงานของกองทัพไทย/u);
  assert.match(event.descriptionKh, /ការរាយការណ៍របស់យោធាថៃ/u);
});

test("Naewna is the only event evidence and the mislabeled Khmer Times row is repaired", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const military = news.find((row) => row.id === militaryId);
  assert.ok(military);
  assert.equal(military.provenanceId, provenanceId);
  assert.match(military.summary, /previous day's fighting, December 22/u);

  const article = news.find((row) => row.id === mismatchedId);
  assert.ok(article);
  assert.equal(article.source, "Khmer Times");
  assert.equal(article.category, "humanitarian");
  assert.equal(article.publishedAt, Date.UTC(2025, 11, 24));
  assert.match(article.title, /CRC sends rice/u);
  assert.match(article.summary, /100 tonnes of rice/u);
  assert.match(article.summary, /does not report Thai 2nd Army strikes/u);
});
