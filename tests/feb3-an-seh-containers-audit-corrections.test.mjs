import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7as3q333mhzm79sqn9ncw61n813pk9";
const ktId = "jn714f9sf5ge8hvpj2k8tde20580qyzd";
const akpId = "jn7eqyvr61320vskf52kgs59kh80jwf6";
const provenanceId = "cambodia-mfa-an-seh-containers-2026-02-05";

test("February 3 An Seh row records the reported placement without an invented time", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-03");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Cambodian MFA Says/u);
  assert.match(event.description, /placed three shipping containers/u);
  assert.match(event.description, /In a February 5 press release/u);
  assert.deepEqual(event.evidenceIds, [ktId, akpId]);
});

test("territorial and legal claims stay attributed to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /the ministry formally protested and said/u);
  assert.match(event.description, /Those territorial and legal characterizations are Cambodia's position/u);
  assert.match(event.description, /do not include a Thai response/u);
  assert.doesNotMatch(event.title, /Block.*Border Gate/iu);
});

test("Thai and Khmer copy preserve dates, three-container count, and attribution", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /3 กุมภาพันธ์/u);
  assert.match(event.descriptionTh, /3 ตู้/u);
  assert.match(event.descriptionTh, /เป็นจุดยืนของกัมพูชา/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 3 ខែកុម្ភៈ/u);
  assert.match(event.descriptionKh, /ចំនួន 3/u);
  assert.match(event.descriptionKh, /គឺជាជំហររបស់កម្ពុជា/u);
});

test("AKP evidence uses the direct publisher URL and shares MFA-statement provenance", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const kt = articles.find((row) => row.id === ktId);
  const akp = articles.find((row) => row.id === akpId);
  assert.ok(kt);
  assert.ok(akp);
  assert.equal(akp.source, "AKP");
  assert.equal(akp.sourceUrl, "https://mail.akp.gov.kh/post/detail/361157");
  assert.equal(akp.credibility, 70);
  assert.equal(kt.provenanceId, provenanceId);
  assert.equal(akp.provenanceId, provenanceId);
});
