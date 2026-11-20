import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks77v9gweb5nv3xexs78bw5mch88va76";
const duplicateId = "ks79ajceq8xf9dmjk2npstmxv5890xsz";
const khmerTimesId = "jn7dbptyq18pm1145wsybk9bsn88txcb";
const annId = "k97ddwzy04cebp9kj1x262nf8s891hb4";
const provenanceId = "cambodia-ssba-border-survey-statement-2026-06-16";

test("June border-survey duplicate rows collapse into the June 15 diplomatic-note event", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-15");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.deepEqual(event.evidenceIds, [khmerTimesId, annId]);
  assert.match(event.title, /Sends New Note.*Joint Border Survey Teams/u);
});

test("surviving copy separates the June 15 request from the June 16 public statement", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /On June 15/u);
  assert.match(event.description, /publicized the request on June 16/u);
  assert.match(event.description, /The delay characterization is Cambodia's position/u);
  assert.doesNotMatch(event.description, /immediate resumption/u);
});

test("Thai and Khmer copy preserve dates, attribution, and JST detail", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.descriptionTh, /15 มิถุนายน/u);
  assert.match(event.descriptionTh, /16 มิถุนายน/u);
  assert.match(event.descriptionTh, /JST/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 15 ខែមិថុនា/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 16 ខែមិថុនា/u);
  assert.match(event.descriptionKh, /JST/u);
});

test("same SSBA statement chain shares provenance and ANN publication date is June 17 local", () => {
  const articles = readJsonl("data/news/2026-06.jsonl");
  const kt = articles.find((row) => row.id === khmerTimesId);
  const ann = articles.find((row) => row.id === annId);
  assert.ok(kt);
  assert.ok(ann);
  assert.equal(kt.provenanceId, provenanceId);
  assert.equal(ann.provenanceId, provenanceId);
  assert.equal(new Date(ann.publishedAt).toISOString(), "2026-06-16T17:00:00.000Z");
  assert.match(ann.summary, /sent another request on June 15/u);
  assert.match(ann.summary, /statement released June 16/u);
});
