import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7787cjvwtk57pnz8f6qzpg1s857jje";
const duplicateIds = [
  "ks7dyfh3qf43c0mp0pxv2kc38s85ba8g",
  "ks74t6y55n8ze27qc1n3dgfg2h859xg5",
];
const starId = "k975bgjm8syw3hztbveaekz20n856mm0";
const thaigerId = "js7f30g9wv6f4d3k1yrzmb3f0n857a32";
const provenanceId = "cambodia-mfa-apr19-border-infrastructure-protest";

test("three infrastructure wrappers collapse into one April 18 event", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-18");
  assert.equal(event.timeOfDay ?? "", "");
  for (const id of duplicateIds) assert.equal(timeline.some((row) => row.id === id), false);
  assert.deepEqual(event.evidenceIds, [starId, thaigerId]);
});

test("surviving copy attributes the construction claims to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.title, /Cambodia Protests Reported Thai Construction/u);
  assert.match(event.description, /Cambodia's Foreign Ministry said/u);
  assert.match(event.description, /These are Cambodian government allegations/u);
  assert.match(event.description, /do not independently establish the territorial claims/u);
  assert.doesNotMatch(event.description, /09:00/u);
});

test("Thai and Khmer copy preserve attribution and the April 19 protest date", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.descriptionTh, /19 เมษายน/u);
  assert.match(event.descriptionTh, /กระทรวงการต่างประเทศกัมพูชา/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 19 ខែមេសា/u);
  assert.match(event.descriptionKh, /ក្រសួងការបរទេសកម្ពុជា/u);
});

test("captured reports share the Cambodian MFA statement provenance", () => {
  const articles = readJsonl("data/news/2026-04.jsonl");
  const star = articles.find((row) => row.id === starId);
  const thaiger = articles.find((row) => row.id === thaigerId);
  assert.ok(star);
  assert.ok(thaiger);
  assert.equal(star.provenanceId, provenanceId);
  assert.equal(thaiger.provenanceId, provenanceId);
  assert.match(star.source, /Phnom Penh Post/u);
  assert.match(star.summary, /April 19 Foreign Ministry protest/u);
  assert.match(thaiger.summary, /Foreign Ministry statement/u);
});
