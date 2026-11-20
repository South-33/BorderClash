import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7brjg649wh4r3jgda4dw2enh8edd0w";
const dapId = "jn73mcdwseshhz9fcpvc8gh7398ecs17";
const akpId = "762a458b6093eb2f93a5814df4604860";
const kplId = "68ca31b4a055bf0a584ff8ef31316798";
const provenanceId = "cmaa-sep13-laos-ordnance-assessment";

test("Ly Thuch ordnance assessment is dated to the September 13 bilateral meeting", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-09-13");
  assert.equal(event.timeOfDay ?? "", "");
  assert.deepEqual(event.evidenceIds, [akpId, kplId]);
  assert.match(event.description, /During September 13 bilateral talks/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("timeline distinguishes the new border-conflict estimate from legacy cluster contamination", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /newly affected nearly 4,000 square kilometres/u);
  assert.match(event.description, /roughly 3,000 square kilometres estimated/u);
  assert.match(event.description, /more than 600 square kilometres of legacy cluster-munition-contaminated land/u);
  assert.match(event.description, /Cambodia's official assessment/u);
  assert.match(event.description, /not an independently measured area/u);
});

test("Thai and Khmer copy preserve the estimates and attribution", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /4,000/u);
    assert.match(event[field], /3,000/u);
    assert.match(event[field], /600/u);
  }
  assert.match(event.descriptionTh, /เป็นการประเมินอย่างเป็นทางการของกัมพูชา/u);
  assert.match(event.descriptionKh, /ជាការវាយតម្លៃផ្លូវការរបស់កម្ពុជា/u);
});

test("DAP is retained as archived evidence from the same CMAA statement chain", () => {
  const articles = readJsonl("data/news/2026-09.jsonl");
  const dap = articles.find((row) => row.id === dapId);
  const akp = articles.find((row) => row.id === akpId);
  const kpl = articles.find((row) => row.id === kplId);
  assert.ok(dap);
  assert.ok(akp);
  assert.ok(kpl);
  assert.equal(dap.status, "archived");
  assert.equal(dap.provenanceId, provenanceId);
  assert.equal(akp.provenanceId, provenanceId);
  assert.equal(kpl.provenanceId ?? "", "");
  assert.match(kpl.summary, /September 13, 2026/u);
});
