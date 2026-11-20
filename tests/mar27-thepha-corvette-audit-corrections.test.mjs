import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const recordId = "ks7ctnx50dqc1zz2bnrhkg6et183q5w8";
const oldEvidenceId = "js76s0mjwcpvt2egb7x4qnfgmh83q74g";
const replacementId = "c21733d495a129c2096b2b9e6ca2e65b";
const provenanceId = "thai-navy-mar27-thepha-corvette-remarks";

test("Mar 27 naval assessment removes the fabricated exact time and delivery claim", () => {
  const row = readJsonl("data/timeline/2026-03.jsonl").find((item) => item.id === recordId);
  assert.ok(row);
  assert.equal(row.date, "2026-03-27");
  assert.equal(Object.hasOwn(row, "timeOfDay"), false);
  assert.equal(row.evidenceIds.length, 1);
  assert.equal(row.evidenceIds[0], replacementId);
  assert.match(row.title, /Future Chinese Corvettes/u);
  assert.match(row.description, /Asked about reports that China would send corvettes/u);
  assert.match(row.description, /does not independently verify/u);
});

test("capturable PPTV evidence replaces the blocked Matichon wrapper on one provenance chain", () => {
  const news = readJsonl("data/news/2026-03.jsonl");
  const oldEvidence = news.find((item) => item.id === oldEvidenceId);
  const replacement = news.find((item) => item.id === replacementId);
  assert.ok(oldEvidence);
  assert.ok(replacement);
  assert.equal(oldEvidence.status, "archived");
  assert.equal(oldEvidence.provenanceId, provenanceId);
  assert.equal(replacement.provenanceId, provenanceId);
  assert.equal(replacement.source, "PPTV HD 36");
  assert.match(replacement.summary, /attributes these claims to the Thai naval commander/u);
  assert.equal(news.some((item) => item.id === "05c9cdcf20d046bd31762fc1b79fb3fb"), false);
});
