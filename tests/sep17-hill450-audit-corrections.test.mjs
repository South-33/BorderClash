import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7a2xv4qds6d73aswj2s8pbp58etyt8";
const evidenceId = "807a964de3cb0a1e7b69db886262b602";

test("Hill 450 resolution is moved to the September 16 Thai 2nd Army statement", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-09-16");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Thai 2nd Army account is not converted into a sovereignty finding", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /2nd Army Area/u);
  assert.match(event.description, /Cambodian side restored/u);
  assert.match(event.description, /characterized the works as encroaching/u);
  assert.match(event.description, /Thai military's account/u);
  assert.match(event.description, /does not independently confirm Cambodia's agreement/u);
  assert.doesNotMatch(event.description, /Cambodian units agreed to dismantle the fortifications/u);
});

test("Thai and Khmer copies preserve the attribution boundary", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  for (const value of ["16", "450"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /คำชี้แจงของฝ่ายทหารไทย/u);
  assert.match(event.descriptionKh, /គណនីរបស់យោធាថៃ/u);
});

test("JS100 evidence records the Thai 2nd Army provenance and attribution", () => {
  const article = readJsonl("data/news/2026-09.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "JS100");
  assert.equal(article.credibility, 60);
  assert.equal(article.provenanceId, "thai-second-army-hill450-restoration-2026-09-16");
  assert.match(article.summary, /September 16/u);
  assert.match(article.summary, /These are Thai military claims/u);
});
