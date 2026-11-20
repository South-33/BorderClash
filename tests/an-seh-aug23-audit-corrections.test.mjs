import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
const eventId = "ks74tpbz387p89zc1vxe04zg5s8dbvrb";
const annId = "k972tsgpb7my0n2zazf7c12f3n8db9jt";
const thaiGovId = "870db574d7ac41217437b181c38a0723";
const akpId = "b04edeab936e2cd835177a69f6d9a882";
const protestProvenance = "cambodia-mfa-an-seh-protest-2026-08-25";

test("An Seh visit keeps the August 23 date without an unverified exact time", () => {
  const event = readJsonl("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-08-23");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.deepEqual(event.evidenceIds, [akpId]);
  assert.match(event.description, /August 26/u);
  assert.match(event.description, /August 23/u);
  assert.match(event.description, /formally protested/u);
  assert.match(event.description, /does not independently establish sovereignty/u);
  assert.match(event.description, /does not.*exact time/u);
});

test("Thai and Khmer copy preserve the visit and protest dates without mojibake", () => {
  const event = readJsonl("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /23/u);
    assert.match(text, /26/u);
    assert.doesNotMatch(text, /14:00/u);
    assert.doesNotMatch(text, /\?{3,}|�/u);
  }
});

test("uncaptured Thai government metadata is not promoted into timeline evidence", () => {
  const news = readJsonl("data/news/2026-08.jsonl");
  const thaiGov = news.find((row) => row.id === thaiGovId);
  const event = readJsonl("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.ok(thaiGov);
  assert.match(thaiGov.summary, /14:00 on August 23, 2026/u);
  assert.equal(event.evidenceIds.includes(thaiGovId), false);
});

test("Cambodian protest copies retain one MFA provenance chain", () => {
  const news = readJsonl("data/news/2026-08.jsonl");
  assert.equal(news.find((row) => row.id === annId)?.provenanceId, protestProvenance);
  assert.equal(news.find((row) => row.id === akpId)?.provenanceId, protestProvenance);
});