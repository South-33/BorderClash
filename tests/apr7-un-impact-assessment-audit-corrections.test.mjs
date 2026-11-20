import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivingId = "ks7febj8yyr27tnsk59v0fe2ps84vd62";
const mergedId = "ks7fh2cp9cj8kkf06vjwcspjbn851fhd";
const primaryId = "43cc927682f9c59c7a84e7ba39fd7a88";
const secondaryA = "jn71vyhhp8thg21xb2prwjr0z184vrqa";
const secondaryB = "k976v8h4xzrr9dphhfg6vsmtp1851bp4";

test("UN impact assessment is anchored to its April 7 publication and duplicate coverage is merged", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === survivingId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-07");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.importance, 78);
  assert.match(event.title, /^UN Publishes Socio-economic Impact Assessment/u);
  assert.deepEqual(event.evidenceIds, [primaryId, secondaryA, secondaryB]);
  assert.match(event.description, /644,589/u);
  assert.match(event.description, /141,850/u);
  assert.match(event.description, /\$277 million/u);
  assert.match(event.description, /\$665 million/u);
  assert.match(event.description, /\$942 million/u);
  assert.match(event.description, /modeled losses/u);
  assert.match(event.description, /not observed cash losses/u);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
});

test("primary UN article summary stays within directly captured publication facts", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const primary = news.find((row) => row.id === primaryId);
  assert.ok(primary);
  assert.equal(new Date(primary.publishedAt).toISOString(), "2026-04-07T00:00:00.000Z");
  assert.match(primary.summary, /644,589/u);
  assert.match(primary.summary, /141,850/u);
  assert.match(primary.summary, /900,000/u);
  assert.doesNotMatch(primary.summary, /\$277|\$665|\$942/u);

  const secondary = news.find((row) => row.id === secondaryA);
  assert.ok(secondary);
  assert.match(secondary.summary, /peaked above 644,000/u);
  assert.match(secondary.summary, /\$277 million/u);
  assert.match(secondary.summary, /\$665 million/u);
});
