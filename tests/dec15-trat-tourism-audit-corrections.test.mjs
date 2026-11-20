import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const timelineId = "ks74zb438ns5jznvnpdkaqvba5813b5h";
const originalEvidenceId = "js7athf48gd42tgk790xvm3gw17xawqv";
const recoveryEvidenceId = "290fd5e1ca2aa8e5617bc9e63165c15b";
const provenanceId = "matichon-trat-tourism-dec15-2025";

function rows(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse);
}

test("Dec 15 Trat tourism row keeps the 40% estimate attributed and removes unsupported time", () => {
  const event = rows("data/timeline/2025-12.jsonl").find(({ id }) => id === timelineId);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [recoveryEvidenceId]);
  assert.match(event.title, /Association Reports 40%/u);
  assert.match(event.description, /association's estimate/u);
  assert.match(event.description, /not an independent province-wide measurement/u);
  assert.doesNotMatch(event.title + event.description, /Tourism Collapses|14:00/u);
});

test("Matichon and its capturable reproduction share one provenance chain", () => {
  const news = rows("data/news/2025-12.jsonl");
  const original = news.find(({ id }) => id === originalEvidenceId);
  const recovery = news.find(({ id }) => id === recoveryEvidenceId);
  assert.equal(original.provenanceId, provenanceId);
  assert.equal(recovery.provenanceId, provenanceId);
  assert.equal(recovery.status, "archived");
  assert.equal(recovery.credibility, 60);
});
