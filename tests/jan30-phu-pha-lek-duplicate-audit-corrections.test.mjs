import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const retainedId = "ks7am0pycmygzn6b73s1v5nns98130rp";
const mergedId = "ks7a0zr48h4qy5pwdr2qmymbf1813p7p";
const armyReportId = "js7a0bagknv88f3gsfw2v4em5d80c6nc";
const thaiPbsId = "js7akwedb5r8jp1wx847w0x00n80f84m";
const naewnaId = "js7eg03q1ma36g18ts9732h96980bmmk";

test("Phu Pha Lek keeps one January 30 event with the directly supported 21:00 time", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === retainedId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-30");
  assert.equal(event.timeOfDay, "21:00");
  assert.match(event.title, /Thai Army Reports 40mm Grenade Incident/u);
  assert.match(event.description, /launcher of unknown origin/u);
  assert.match(event.description, /fired warning shots/u);
  assert.match(event.description, /does not independently establish who fired the 40mm round/u);
  assert.deepEqual(event.evidenceIds, [armyReportId, thaiPbsId, naewnaId]);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
});

test("English, Thai, and Khmer retain the same exact times and uncertainty", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === retainedId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /20:10/u);
    assert.match(event[field], /21:00/u);
    assert.match(event[field], /40/u);
  }
  assert.match(event.descriptionTh, /ไม่ทราบจุดยิง/u);
  assert.match(event.descriptionKh, /មិនដឹងទីតាំងបាញ់/u);
});

test("retrospective Naewna report shares provenance with the Second Army timeline it reproduces", () => {
  const articles = readJsonl("data/news/2026-01.jsonl");
  const armyReport = articles.find((row) => row.id === armyReportId);
  const naewna = articles.find((row) => row.id === naewnaId);
  assert.equal(armyReport?.provenanceId, "thai-second-army-jan30-phu-pha-lek");
  assert.equal(naewna?.provenanceId, "thai-second-army-jan30-phu-pha-lek");
  assert.match(naewna?.summary ?? "", /previous night's Phu Pha Lek incident/u);
  assert.match(naewna?.summary ?? "", /launch point was unknown/u);
});
