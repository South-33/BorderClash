import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const timelineId = "ks7dekrzj1cs4gdn8fxp2xvsv9812v37";
const evidenceId = "7c70744c856ba10cb70e7a1894ec72e8";
const oldEvidenceId = "js77andn3wqjg6qcjdrw2hxdgd80aw1m";
const provenanceId = "trat-32-thai-scam-victims-jan31-2026";

function rows(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse);
}

test("32-person return is dated Jan 31 while Jan 17 remains the witness escape date", () => {
  const event = rows("data/timeline/2026-01.jsonl").find(({ id }) => id === timelineId);
  assert.equal(event.date, "2026-01-31");
  assert.equal(event.timeOfDay, "14:00");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /One returned man said he and friends had escaped.+January 17/u);
  assert.match(event.description, /his account and are not independently established/u);
  assert.doesNotMatch(event.description, /Thai authorities assisted 32 citizens in escaping/u);
});

test("capturable Workpoint report shares provenance with the blocked Daily News report", () => {
  const news = rows("data/news/2026-01.jsonl");
  const replacement = news.find(({ id }) => id === evidenceId);
  const oldEvidence = news.find(({ id }) => id === oldEvidenceId);
  assert.equal(replacement.provenanceId, provenanceId);
  assert.equal(oldEvidence.provenanceId, provenanceId);
  assert.equal(replacement.status, "archived");
  assert.equal(replacement.credibility, 70);
});
