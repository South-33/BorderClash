import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks70ey0bdbv5jv550h8wkcmkpn8bgr38";
const oldEvidenceId = "k97cj2305rgmpjzt9h2btf2hyx8bhmbm";
const newEvidenceId = "0bfdc00ec2427d02f232d96e9de7b865";

test("July 29 border coordination meeting is date-only and names both officials", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-29");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.description, /Col\. Bancha Chanchalad/u);
  assert.match(event.description, /Brig\. Gen\. Lai Khem Huot/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("meeting terms preserve ceasefire humanitarian and checkpoint details", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /humanitarian coordination/u);
  assert.match(event.description, /closed except for citizen repatriation/u);
  assert.match(event.description, /December 27, 2025 ceasefire/u);
  assert.match(event.description, /2000 land-boundary MOU/u);
  assert.match(event.description, /avoid provocative actions/u);
});

test("timeline cites only the readable archived evidence", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  const event = timeline.find((row) => row.id === eventId);
  const articles = readJsonl("data/news/2026-07.jsonl");
  const oldEvidence = articles.find((row) => row.id === oldEvidenceId);
  const newEvidence = articles.find((row) => row.id === newEvidenceId);
  assert.deepEqual(event.evidenceIds, [newEvidenceId]);
  assert.equal(oldEvidence.status, "archived");
  assert.ok(newEvidence);
  assert.match(newEvidence.summary, /Bancha Chanchalad/u);
  assert.match(newEvidence.summary, /Lai Khem Huot/u);
});
