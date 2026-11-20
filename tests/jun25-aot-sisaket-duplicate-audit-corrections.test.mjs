import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const retainedId = "ks74jdsc7qvp9jq4exzrmptf9189cdpt";
const mergedId = "ks7csg6qfdyw74q3dzk85hx3vd89f0hw";
const thaiPbsId = "jn7b3qxc036s36k5cyqvd1cehn89dkmc";
const naewnaId = "js78hp08719dj0kdvzs4xys6a189f5ae";

test("Si Sa Ket AOT mission is one June 25 date-only event", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const event = timeline.find((row) => row.id === retainedId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-25");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(timeline.some((row) => row.id === mergedId), false);
  assert.match(event.title, /ASEAN Observer Team Visits Si Sa Ket Border Sites/u);
  assert.deepEqual(event.evidenceIds, [thaiPbsId, naewnaId]);
});

test("event wording keeps the Thai briefings attributed and does not claim a general border reopening", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === retainedId);
  assert.ok(event);
  assert.match(event.description, /Thai officials briefed the observers/u);
  assert.match(event.description, /alleged anti-personnel mine use/u);
  assert.match(event.description, /transparency measure/u);
  assert.match(event.description, /does not support a general border reopening/u);
  assert.match(event.description, /does not support.*exact start time/u);
});

test("English, Thai and Khmer preserve the mission date and 13-member delegation", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === retainedId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /25/u);
    assert.match(event[field], /13/u);
  }
});

test("Thai PBS and Naewna are one Second Army provenance chain", () => {
  const articles = readJsonl("data/news/2026-06.jsonl");
  const thaiPbs = articles.find((row) => row.id === thaiPbsId);
  const naewna = articles.find((row) => row.id === naewnaId);
  assert.ok(thaiPbs);
  assert.ok(naewna);
  assert.equal(thaiPbs.provenanceId, "thai-second-army-jun25-aot-sisaket-visit");
  assert.equal(naewna.provenanceId, "thai-second-army-jun25-aot-sisaket-visit");
  assert.match(naewna.summary, /previous day, June 25/u);
  assert.match(naewna.summary, /not a general reopening/u);
});
