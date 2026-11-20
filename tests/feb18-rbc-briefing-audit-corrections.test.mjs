import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks74v7hcawpeqkgh0mgfhjyh1181ey6z";
const prdId = "js761kbbz8ma50r55q2fryh6vx81f6v4";
const mfaId = "2ac80b4551dc4db4a495ec17b725b3ed";
const provenanceId = "thai-mfa-feb18-rbc-briefing";

test("Feb 18 RBC record uses the supported 11:00 briefing time without a deadlock claim", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-18");
  assert.equal(event.timeOfDay, "11:00");
  assert.match(event.title, /Have Yet to Reach Consensus/u);
  assert.doesNotMatch(event.title, /Deadlock/u);
  assert.match(event.description, /3 formal Regional Border Committee/u);
  assert.match(event.description, /positive development/u);
  assert.match(event.description, /negotiations would continue/u);
  assert.match(event.description, /did not describe the talks as a deadlock/u);
  assert.doesNotMatch(event.description, /deepening mistrust following/u);
  assert.deepEqual(event.evidenceIds, [mfaId, prdId]);
});

test("English, Thai and Khmer preserve the time, three meetings and continued negotiations", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /11:00/u);
    assert.match(event[field], /3/u);
    assert.match(event[field], /RBC/u);
  }
  assert.match(event.descriptionTh, /พัฒนาการเชิงบวก/u);
  assert.match(event.descriptionTh, /เจรจาต่อ/u);
  assert.match(event.descriptionKh, /វឌ្ឍនភាពវិជ្ជមាន/u);
  assert.match(event.descriptionKh, /បន្តចរចា/u);
});

test("PRD and direct MFA evidence share one provenance chain", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const prd = articles.find((row) => row.id === prdId);
  const mfa = articles.find((row) => row.id === mfaId);
  assert.ok(prd);
  assert.ok(mfa);
  assert.equal(prd.provenanceId, provenanceId);
  assert.equal(mfa.provenanceId, provenanceId);
  assert.equal(mfa.credibility, 100);
  assert.match(mfa.title, /18 February 2026 at 11:00 hrs/u);
  assert.match(prd.summary, /positive development/u);
  assert.match(prd.summary, /negotiations would continue/u);
});
