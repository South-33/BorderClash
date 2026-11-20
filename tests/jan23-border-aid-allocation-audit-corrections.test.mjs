import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78pyszcse2xhcvesmz88egv1812zn3";
const oldEvidenceId = "js76grw8tqpsy8spdy7e6h3hfd7ztkad";
const capturedEvidenceId = "ac1a4c3eabe64553900f632f6f0aeef4";
const provenanceId = "thai-government-border-aid-allocation-2026-01-23";

test("January 23 aid milestone is date-only and records allocation rather than completed payout", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-23");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Receives ฿2\.336 Billion Allocation/u);
  assert.match(event.description, /would verify recipient records and expedite disbursement/u);
  assert.match(event.description, /does not establish that the full allocation/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("the event preserves the approval history and eligible-household ceiling", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /previously approved by Cabinet on December 23/u);
  assert.match(event.description, /467,128 eligible households/u);
  assert.match(event.description, /seven provinces/u);
  assert.match(event.descriptionTh, /467,128 ครัวเรือน/u);
  assert.match(event.descriptionKh, /467,128 គ្រួសារ/u);
});

test("timeline cites the captured January 23 government-spokesman report", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.deepEqual(event.evidenceIds, [capturedEvidenceId]);
});

test("duplicate reporting shares one government-spokesman provenance chain", () => {
  const articles = readJsonl("data/news/2026-01.jsonl");
  const oldArticle = articles.find((row) => row.id === oldEvidenceId);
  const capturedArticle = articles.find((row) => row.id === capturedEvidenceId);
  assert.ok(oldArticle);
  assert.ok(capturedArticle);
  assert.equal(oldArticle.provenanceId, provenanceId);
  assert.equal(capturedArticle.provenanceId, provenanceId);
  assert.equal(oldArticle.category, "humanitarian");
  assert.match(capturedArticle.summary, /did not establish that the full allocation had already reached households/u);
});
