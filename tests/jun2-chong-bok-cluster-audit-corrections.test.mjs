import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const statementId = "ks74e8rdwaz1d68z7dx68wjzyn87wzgv";
const standoffId = "ks71v3n3ptrxwj8mgt0vmxm1tx882f03";
const naewnaStatementId = "js79nfbx779427h5g82t5jt9en87xhyv";
const prdStatementId = "e699ba64885d59039e70587b77d9cba0";
const khmerTimesStandoffId = "jn749rav8kx7d62pkf013agf9x882jjz";
const naewnaStandoffId = "c07aea886088401b34364b9e42a83495";

test("June 2 Army protest response is date-only and does not collapse all construction into Chong Bok", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const event = timeline.find((row) => row.id === statementId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-02");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Responds to Cambodia's Protest/u);
  assert.match(event.description, /statues and flags were in areas under Thai sovereignty and control/u);
  assert.match(event.description, /barbed wire at Chong Bok was a security measure/u);
  assert.match(event.description, /not an independent determination of sovereignty/u);
  assert.deepEqual(event.evidenceIds, [naewnaStatementId, prdStatementId]);
});

test("June 2 Chong Bok standoff keeps its own supported timeline and separates the An Ses observer mission", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const event = timeline.find((row) => row.id === standoffId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-02");
  assert.equal(event.timeOfDay, "08:50");
  assert.match(event.title, /Mom Bei\/Chong Bok/u);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /08:50/u);
    assert.match(event[field], /10:30/u);
    assert.match(event[field], /11:08/u);
  }
  assert.match(event.description, /separately visiting An Ses/u);
  assert.match(event.description, /does not place it at the Chong Bok standoff/u);
  assert.deepEqual(event.evidenceIds, [khmerTimesStandoffId, naewnaStandoffId]);
});

test("June 2 evidence registry preserves distinct provenance and corrects the observer-location conflation", () => {
  const articles = readJsonl("data/news/2026-06.jsonl");
  const naewnaStatement = articles.find((row) => row.id === naewnaStatementId);
  const prdStatement = articles.find((row) => row.id === prdStatementId);
  const khmerTimesStandoff = articles.find((row) => row.id === khmerTimesStandoffId);
  const naewnaStandoff = articles.find((row) => row.id === naewnaStandoffId);

  assert.equal(naewnaStatement?.provenanceId, "thai-army-jun2-border-construction-response");
  assert.equal(prdStatement?.provenanceId, "thai-army-jun2-border-construction-response");
  assert.equal(naewnaStandoff?.provenanceId, "thai-second-army-jun2-chong-bok-standoff");
  assert.match(khmerTimesStandoff?.summary ?? "", /separately reported that an ASEAN Observer Team visited An Ses/u);
  assert.match(khmerTimesStandoff?.summary ?? "", /did not place the observers at the Mom Bei\/Chong Bok standoff/u);
});
