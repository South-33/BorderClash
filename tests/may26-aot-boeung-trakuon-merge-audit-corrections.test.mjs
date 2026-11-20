import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const retainedId = "ks76b16dgmtz7sd7p8cw86sbb987hmhv";
const mergedId = "ks7amqsmfy04vr64xcf6fqqx5h87gp1k";
const akpId = "536288cca0019b04c284b985d2a1da75";
const rnkId = "ec0445dfa7b4b454e824f0a63cfff777";
const khmerTimesId = "js7fhtv246nd8qjhzjzcxy8vtd87hbk1";
const khmerTimesVariantId = "jnbb33bd90091fd4f778b5b0429ee4a1";
const provenanceId = "cambodia-mod-aot-boeung-trakuon-2026-05-26";

test("May 26 retains one AOT Boeung Trakuon mission and removes the duplicate May 27 row", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const retained = timeline.find((row) => row.id === retainedId);
  assert.ok(retained);
  assert.equal(retained.date, "2026-05-26");
  assert.equal(retained.timeOfDay, "09:30");
  assert.deepEqual(retained.evidenceIds, [akpId]);
  assert.match(retained.title, /Boeung Trakuon/u);
  assert.match(retained.description, /Kok Romiet commune, Thma Puok district/u);
  assert.match(retained.description, /Those territorial allegations are Cambodia's claims/u);
  assert.match(retained.description, /does not establish sovereignty or unlawful occupation/u);
  assert.doesNotMatch(retained.description, /Phnom Trob/u);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
});

test("Thai and Khmer copy preserve date, time, location, and attribution", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === retainedId);
  assert.ok(event);
  assert.match(event.descriptionTh, /09:30/u);
  assert.match(event.descriptionTh, /วันที่ 26 พฤษภาคม/u);
  assert.match(event.descriptionTh, /บึงตระกวน/u);
  assert.match(event.descriptionTh, /เป็นคำกล่าวของกัมพูชา/u);
  assert.match(event.descriptionKh, /09:30/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 26 ខែឧសភា/u);
  assert.match(event.descriptionKh, /បឹងត្រកួន/u);
  assert.match(event.descriptionKh, /ជាការអះអាងរបស់កម្ពុជា/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("government and Khmer Times copies share one Ministry provenance chain", () => {
  const articles = readJsonl("data/news/2026-05.jsonl");
  for (const id of [akpId, rnkId, khmerTimesId, khmerTimesVariantId]) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId);
  }
  const akp = articles.find((row) => row.id === akpId);
  const khmerTimes = articles.find((row) => row.id === khmerTimesId);
  assert.equal(akp.credibility, 90);
  assert.equal(khmerTimes.credibility, 80);
  assert.match(akp.summary, /May 26 at 09:30/u);
  assert.match(khmerTimes.summary, /Cambodian Ministry of National Defence account/u);
});
