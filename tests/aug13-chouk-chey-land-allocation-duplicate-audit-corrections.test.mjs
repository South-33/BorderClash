import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks77ff4j84qrfzxg92zsdpw97h8cxcnr";
const duplicateId = "ks72yj831pa14py92sqgr0sv8h8cgtes";
const akpId = "74c6bebbf4c6c3eab773ef58acd6ea81";
const khmerTimesId = "jn7b2psk3877fhbgynrppfkks18cwqms";
const dapId = "jn77n021ramsvb0v2269tgzn6s8chb5n";
const provenanceId = "cambodia-mfa-chouk-chey-land-allocation-2026-08";

test("Chouk Chey duplicate rows collapse into one Aug 13 date-only event", () => {
  const timeline = readJsonl("data/timeline/2026-08.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-08-13");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.deepEqual(event.evidenceIds, [akpId, khmerTimesId, dapId]);
});

test("surviving copy attributes the land-allocation and legal claims to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-08.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.title, /Cambodian MFA Says Thai Authorities Allocated Land/u);
  assert.match(event.description, /Cambodia's Foreign Ministry said/u);
  assert.match(event.description, /These territorial and legal characterizations are Cambodia's position/u);
  assert.match(event.description, /do not include a Thai response/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("Thai and Khmer localization preserve attribution and boundary-pillar detail", () => {
  const event = readJsonl("data/timeline/2026-08.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.descriptionTh, /กระทรวงการต่างประเทศกัมพูชาระบุ/u);
  assert.match(event.descriptionTh, /45 และ 47/u);
  assert.match(event.descriptionKh, /ក្រសួងការបរទេសកម្ពុជា/u);
  assert.match(event.descriptionKh, /45 និង 47/u);
});

test("AKP, Khmer Times, and DAP share one Cambodian MFA provenance chain", () => {
  const articles = readJsonl("data/news/2026-08.jsonl");
  for (const id of [akpId, khmerTimesId, dapId]) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId, id);
  }
});
