import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks703xvv09kbd8jp3qacqkh9h184jj9w";
const capturedId = "be26158f63b67e7b2ea51146ed3a7f5b";
const tv5Id = "js797kpet2dpwkadbh3j3pcj4d84mwqm";
const bangkokPostId = "js7acknrywzndn674y08kdpkhd84k546";
const provenanceId = "thai-army-border-shelters-2026-04-09";

test("Apr 9 shelter milestone is date-only and cites captured evidence", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-09");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [capturedId]);
});

test("shelter figures and status match the captured Army announcement", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  for (const value of ["182", "117", "65", "80", "108", "74"]) {
    assert.ok(event.description.includes(value), value);
  }
  assert.match(event.description, /Royal Thai Army said/u);
  assert.match(event.description, /still under construction/u);
  assert.doesNotMatch(event.title, /Completes 117 Border Civilian Shelters/u);
});

test("Thai and Khmer copies preserve all project figures", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  for (const value of ["182", "117", "65", "80", "108", "74"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
});

test("all three reports share one Army-announcement provenance chain", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  for (const id of [capturedId, tv5Id, bangkokPostId]) {
    const article = news.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId);
  }
  const captured = news.find((row) => row.id === capturedId);
  assert.equal(captured.source, "The Bangkok Insight");
  assert.match(captured.summary, /117 had been completed/u);
});
