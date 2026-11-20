import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const senateId = "ks7e4tnwrf9eky96xh0dfy1nax83q8vg";
const responseId = "ks73c9ndgren4c0f84vww32v1983ptvf";
const duplicateResponseId = "ks78x5cc1nf8ryrbq7basqq7js83regd";
const directResponseArticleId = "k971nffpsaeezd7zvz9m0r3qph83nh7e";
const followupArticleId = "k971mdkdahq3e3x41q8rgh9r8n83m0rp";

test("Thai Senate committee recommendation remains a distinct March 24 event", () => {
  const rows = readJsonl("data/timeline/2026-03.jsonl");
  const event = rows.find((row) => row.id === senateId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-24");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Committee Recommends Revoking MOU 2000/u);
  assert.match(event.description, /not itself a government termination/u);
  assert.match(event.description, /alleged Cambodian breaches/u);
  assert.ok(!event.evidenceIds.includes("jn78stm93fgfq4ybcqp50sy40983q3wn"));
  assert.ok(event.evidenceIds.includes(followupArticleId));
});

test("Cambodia's MOU 2000 response is one March 26 event with the older stable ID", () => {
  const rows = readJsonl("data/timeline/2026-03.jsonl");
  const event = rows.find((row) => row.id === responseId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-26");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /stated legal and political positions/u);
  assert.deepEqual(event.evidenceIds, [directResponseArticleId, followupArticleId]);
  assert.equal(rows.some((row) => row.id === duplicateResponseId), false);
});

test("captured Khmer Times reports share the SSBA March 26 provenance chain", () => {
  const rows = readJsonl("data/news/2026-03.jsonl");
  const direct = rows.find((row) => row.id === directResponseArticleId);
  const followup = rows.find((row) => row.id === followupArticleId);
  assert.ok(direct);
  assert.ok(followup);
  assert.equal(direct.provenanceId, "cambodia-ssba-mou2000-mar26");
  assert.equal(followup.provenanceId, direct.provenanceId);
});
