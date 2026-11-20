import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks712p9te23mac951901mv76dn81xctm";
const duplicateId = "ks793741ysy6zgw3kby5b5870h823faw";
const khmerTimesId = "jn7cd0rpf6h2p244wf5s0e7fjh81wyy6";
const cambodiaId = "c7e2779785d784818537b5d766db0faf";
const thailandId = "233e7da44202233d2fbfb846106ec85d";

test("Feb 26 duplicate is merged into a date-only Feb 24 UNHRC event", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-02-24");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Cambodia and Thailand Trade Border Accusations/u);
  assert.deepEqual(event.evidenceIds, [cambodiaId, thailandId, khmerTimesId]);
});

test("merged event attributes both governments' positions without asserting either territorial claim", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /Prak Sokhonn alleged/u);
  assert.match(event.description, /territory Cambodia claims as its own/u);
  assert.match(event.description, /Sihasak Phuangketkeow rejected Cambodia's allegation/u);
  assert.match(event.description, /said both sides had agreed under the ceasefire/u);
  assert.match(event.description, /online scam networks as a global human-rights crisis/u);
  assert.match(event.description, /claims remain attributed to the respective governments/u);
});

test("English, Thai and Khmer preserve the Feb 24 date and both sides' attribution", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /24/u);
    assert.match(event[field], /Sihasak Phuangketkeow/u);
  }
  assert.match(event.description, /UN Human Rights Council/u);
  assert.match(event.descriptionTh, /UNHRC/u);
  assert.match(event.descriptionKh, /UNHRC/u);
  assert.match(event.descriptionTh, /กัมพูชาอ้างว่าเป็นของตน/u);
  assert.match(event.descriptionKh, /កម្ពុជាអះអាងថាជារបស់ខ្លួន/u);
});

test("direct Cambodian and Thai evidence anchor the event date and positions", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const cambodia = articles.find((row) => row.id === cambodiaId);
  const thailand = articles.find((row) => row.id === thailandId);
  const khmerTimes = articles.find((row) => row.id === khmerTimesId);
  assert.ok(cambodia);
  assert.ok(thailand);
  assert.ok(khmerTimes);
  assert.equal(cambodia.provenanceId, "cambodia-mfa-unhrc-feb24-2026");
  assert.equal(thailand.provenanceId, "thai-mfa-unhrc-feb24-2026");
  assert.equal(thailand.credibility, 100);
  assert.match(cambodia.summary, /February 24 intervention/u);
  assert.match(thailand.summary, /February 24 statement/u);
  assert.match(khmerTimes.summary, /February 24 UN Human Rights Council exchange/u);
});
