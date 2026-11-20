import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks704x7ty0c4q20fe6kktrqe6h81305r";
const pptvId = "js76acg6e51wq0g5rxexvkks6h7x89gg";
const thaiRathId = "c686d4dc38506f940208415cd4870de6";
const provenanceId = "thai-2nd-army-dec8-13-summary-2025-12-14";

test("December 14 casualty row removes the invented 09:00 event time and later aggregates", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /16th Soldier Death/u);
  assert.match(event.title, /181 Cambodian/u);
  assert.doesNotMatch(event.description, /327/u);
  assert.doesNotMatch(event.description, /480/u);
  assert.deepEqual(event.evidenceIds, [pptvId, thaiRathId]);
});

test("Thai losses and Cambodian-loss claims remain distinct and attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /16th military death/u);
  assert.match(event.description, /10:20/u);
  assert.match(event.description, /summary covering December 8-13/u);
  assert.match(event.description, /claimed that 181 Cambodian soldiers/u);
  assert.match(event.description, /not independently verified/u);
});

test("Thai and Khmer copy preserve 16, 181, 48, and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["16", "181", "48", "10:20"]) {
    assert.match(event.descriptionTh, new RegExp(value, "u"));
    assert.match(event.descriptionKh, new RegExp(value, "u"));
  }
  assert.match(event.descriptionTh, /เป็นคำกล่าวของกองทัพไทย/u);
  assert.match(event.descriptionKh, /ជាការអះអាងរបស់យោធាថៃ/u);
});

test("Thai Rath, Khaosod and Thai PBS share the 2nd Army Region summary provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  for (const id of [thaiRathId, "js70r233397g133h5b9nh0g8eh7x8dvg", "js72kmnc5rghejzycmn6e4xks57x9rkb"]) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId, id);
  }
  const pptv = articles.find((row) => row.id === pptvId);
  assert.ok(pptv);
  assert.match(pptv.summary, /16th military death at 10:20/u);
  assert.match(pptv.summary, /181 Cambodian soldiers killed/u);
});
