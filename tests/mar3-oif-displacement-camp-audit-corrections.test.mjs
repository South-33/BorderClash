import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7e2s2wsra1r6rjdhemwq5xsn82casm";
const akpId = "0186950eae6cad8d9d53f2aba50ab53d";
const cambodianessId = "5eaa393397263ac1e2bd5ed061d45bf5";
const annId = "jn7ck0b4c8v75aqjd4qcvtd2jh82cc5w";

test("OIF camp visit uses the two-source March 3 date and no invented exact time", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-03");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Visits Siem Reap Displacement Camp/u);
  assert.deepEqual(event.evidenceIds, [akpId, cambodianessId, annId]);
});

test("event preserves the supported family count and keeps disputed border claims attributed", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /414 families/u);
  assert.match(event.description, /1,395 people/u);
  assert.match(event.description, /according to local officials/u);
  assert.match(event.description, /reported Thai military incursions/u);
  assert.match(event.description, /article instead dated the visit March 2/u);
  assert.match(event.description, /claims remain attributed/u);
  assert.doesNotMatch(event.description, /She documented the continued presence/u);
});

test("Thai and Khmer copy preserve date, count, source disagreement and attribution", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /3/u);
    assert.match(event[field], /414/u);
    assert.match(event[field], /1,395/u);
    assert.match(event[field], /2/u);
    assert.match(event[field], /AKP/u);
    assert.match(event[field], /Cambodianess/u);
    assert.match(event[field], /Phnom Penh Post \/ Asia News Network/u);
  }
});

test("blocked ANN article summary records its own March 2 dating and attributes barrier claims", () => {
  const article = readJsonl("data/news/2026-03.jsonl").find((row) => row.id === annId);
  assert.ok(article);
  assert.match(article.summary, /dated the visit March 2/u);
  assert.match(article.summary, /414 families or 1,395 people/u);
  assert.match(article.summary, /it described as Thai military barricades/u);
});
