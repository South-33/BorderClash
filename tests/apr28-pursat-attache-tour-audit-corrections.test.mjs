import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7cwy1v6j0kjgfr7049fkbxj185swfm";
const ktId = "jn7bgfse79twk1azbk1kkf76xh85qxc5";
const akpId = "jn7c4rzrwtdafdn2r247btcg2985rwvv";
const dapId = "jn7f88g34k5t2f1493y4mbqvfd85sjge";
const provenanceId = "cambodia-mod-macpp-pursat-tour-2026-04-28";

test("April 28 attaché-tour row starts at the supported 12:54 Ou Phluk stop", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-28");
  assert.equal(event.timeOfDay, "12:54");
  assert.match(event.title, /Two Pursat Border Sites/u);
  assert.match(event.description, /Ou Phluk Damrei.*12:54/u);
  assert.match(event.description, /Chey Chumneas.*13:35/u);
  assert.deepEqual(event.evidenceIds, [ktId, akpId]);
  assert.equal(event.evidenceIds.includes(dapId), false);
});

test("blockade and occupation claims stay attributed to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Cambodia's Defence Ministry said/u);
  assert.match(event.description, /Those blockade and occupation characterizations are Cambodia's position/u);
  assert.match(event.description, /do not independently verify them/u);
  assert.doesNotMatch(event.title, /Blockade/u);
});

test("Thai and Khmer copy preserve both times and Cambodian attribution", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["12:54", "13:35"]) {
    assert.match(event.descriptionTh, new RegExp(value, "u"));
    assert.match(event.descriptionKh, new RegExp(value, "u"));
  }
  assert.match(event.descriptionTh, /กระทรวงกลาโหมกัมพูชา/u);
  assert.match(event.descriptionTh, /เป็นจุดยืนของกัมพูชา/u);
  assert.match(event.descriptionKh, /ក្រសួងការពារជាតិកម្ពុជា/u);
  assert.match(event.descriptionKh, /គឺជាជំហររបស់កម្ពុជា/u);
});

test("Khmer Times and AKP share the Cambodian Defence Ministry tour provenance", () => {
  const articles = readJsonl("data/news/2026-04.jsonl");
  const kt = articles.find((row) => row.id === ktId);
  const akp = articles.find((row) => row.id === akpId);
  assert.ok(kt);
  assert.ok(akp);
  assert.equal(kt.provenanceId, provenanceId);
  assert.equal(akp.provenanceId, provenanceId);
  assert.match(kt.summary, /12:54 p\.m\./u);
  assert.match(akp.summary, /1:35 p\.m\./u);
});
