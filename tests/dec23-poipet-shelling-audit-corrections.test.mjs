import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks79pwdjr6jm0kcdh60bs9zgt1813dz9";
const khmerTimesId = "jn71vrryffm1pp8pjtcdsrsmk17xvmvk";
const dapId = "jn7cdcw5cnr0zw58n8623f5v6n7xt31n";
const unrelatedArticleId = "jn7a1xr8hpecss732j4czgpezs7xrrjs";
const provenanceId = "cambodia-mod-dec23-poipet-0801";

test("Dec 23 Poipet shelling keeps the directly supported 08:01 time and source attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, "08:01");
  assert.match(event.title, /Cambodian Defence Ministry Reports Two Shells/u);
  assert.match(event.description, /two shells/u);
  assert.match(event.description, /O Russey Sangkat/u);
  assert.match(event.description, /Nimit Sangkat/u);
  assert.match(event.description, /do not independently verify/u);
  assert.deepEqual(event.evidenceIds, [khmerTimesId, dapId]);
  assert.equal(event.evidenceIds.includes(unrelatedArticleId), false);
});

test("Khmer Times and DAP News carry the same Cambodian Defence Ministry source chain", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const khmerTimes = news.find((row) => row.id === khmerTimesId);
  const dap = news.find((row) => row.id === dapId);
  assert.ok(khmerTimes);
  assert.ok(dap);
  assert.equal(khmerTimes.provenanceId, provenanceId);
  assert.equal(dap.provenanceId, provenanceId);
  assert.match(khmerTimes.summary, /8:01 AM on December 23/u);
  assert.match(dap.summary, /Ministry of National Defence reported/u);
  assert.match(dap.summary, /08:01 on December 23/u);
});
