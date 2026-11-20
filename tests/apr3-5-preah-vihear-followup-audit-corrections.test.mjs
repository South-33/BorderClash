import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const humanitarianId = "ks7f1z2f366e1tvz2xp98vmyfd844hmf";
const duplicateHumanitarianId = "ks77kk588zsqaqnt8y2ah67q4s84aq99";
const activityId = "ks7ea6bcweq013vg1vt7t6t7q984e67g";
const protestId = "ks773t3pk4bv9m83ae3wf7bqm984ztfn";
const kptHumanitarianId = "8b0bb48b2021f403df50fa20890dfdd3";
const ktHumanitarianId = "jn71tp3wjp0aycfsgqdhygjbe1845m5g";
const mixedId = "jn7cc2m2ps1dn09rkf62p2e60h84begm";
const akpProtestId = "jn7dj6d9g329yttxm4s66k9znn84ab86";

test("Interior Ministry displacement snapshot is one Apr 3 event with exact reported count", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === humanitarianId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-03");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.category, "humanitarian");
  assert.deepEqual(event.evidenceIds, [kptHumanitarianId]);
  assert.match(event.title, /34,937/u);
  assert.match(event.description, /610,000/u);
  assert.match(event.description, /more than 640,000/u);
  assert.match(event.description, /34,937/u);
  assert.equal(timeline.some((row) => row.id === duplicateHumanitarianId), false);
});

test("Apr 4 activity and Apr 5 protest remain distinct milestones", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const activity = timeline.find((row) => row.id === activityId);
  const protest = timeline.find((row) => row.id === protestId);
  assert.ok(activity);
  assert.ok(protest);
  assert.equal(activity.date, "2026-04-04");
  assert.equal(activity.category, "military");
  assert.equal(protest.date, "2026-04-05");
  assert.equal(protest.timeOfDay, "");
  assert.equal(protest.category, "diplomatic");
  assert.deepEqual(protest.evidenceIds, [akpProtestId]);
  assert.match(protest.title, /Formally Protests/u);
  assert.match(protest.description, /occurred the previous day/u);
  assert.match(protest.description, /territorial allegations remain Cambodia's position/u);
});

test("Thai and Khmer copy preserve dates, figures and attribution", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  for (const id of [humanitarianId, protestId]) {
    const event = timeline.find((row) => row.id === id);
    assert.ok(event);
    assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
    assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
    assert.doesNotMatch(event.titleTh + event.descriptionTh + event.titleKh + event.descriptionKh, /�|\?{3,}/u);
  }
  const humanitarian = timeline.find((row) => row.id === humanitarianId);
  const protest = timeline.find((row) => row.id === protestId);
  for (const text of [humanitarian.descriptionTh, humanitarian.descriptionKh]) {
    assert.match(text, /610,000/u);
    assert.match(text, /640,000/u);
    assert.match(text, /34,937/u);
  }
  for (const text of [protest.descriptionTh, protest.descriptionKh]) {
    assert.match(text, /5/u);
    assert.match(text, /100/u);
    assert.match(text, /GBC/u);
  }
});

test("Interior Ministry reports share provenance and Apr 6 article is treated as a composite", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const byId = (id) => news.find((row) => row.id === id);
  const provenance = "cambodia-interior-displacement-2026-04-03";
  assert.equal(byId(kptHumanitarianId).provenanceId, provenance);
  assert.equal(byId(ktHumanitarianId).provenanceId, provenance);
  assert.match(byId(kptHumanitarianId).summary, /34,937/u);
  assert.match(byId(ktHumanitarianId).summary, /April 3/u);
  assert.equal(byId(mixedId).category, "diplomatic");
  assert.match(byId(mixedId).summary, /three earlier Cambodian government updates/u);
  assert.match(byId(mixedId).summary, /Interior Ministry displacement figures already reported on April 3/u);
});

test("Apr 5 protest copies share one MFA provenance chain", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const byId = (id) => news.find((row) => row.id === id);
  const provenance = "cambodia-mfa-preah-vihear-protest-2026-04-05";
  for (const id of [
    akpProtestId,
    "k97ddr6xg80kqhymc4zcngw7wx84y386",
    "jn7a55qwwhe071karvw8h84gj184fsvm",
  ]) {
    assert.equal(byId(id).category, "diplomatic");
    assert.equal(byId(id).provenanceId, provenance);
  }
  assert.equal(byId(akpProtestId).credibility, 80);
  assert.match(byId(akpProtestId).summary, /formal protest on April 5/u);
  assert.match(byId(akpProtestId).summary, /occurred on April 4/u);
});
