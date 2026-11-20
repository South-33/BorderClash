import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks77xxrspe11a065frxgtpjpgd813rsk";
const akpId = "e15edaeb7a27a6c41e5774f32e646878";

test("Dec 14 cluster-munition milestone uses the captured 03:10 report", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, "03:10");
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [akpId]);
  assert.match(event.title, /Cambodia Reports/u);
});

test("deployment and legal assessment stay explicitly attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /According to a Cambodian 4th Military Region report/u);
  assert.match(event.description, /near Preah Vihear Temple at 03:10/u);
  assert.match(event.description, /December 15 letter/u);
  assert.match(event.description, /Cambodian official claims/u);
  assert.match(event.description, /published on December 16/u);
  assert.match(event.description, /does not independently verify/u);
  assert.doesNotMatch(event.description, /poison gas|war crimes/u);
});

test("Thai and Khmer copies preserve time, date, attribution and uncertainty", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of ["03:10", "14", "4"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /จุดยืนของเจ้าหน้าที่กัมพูชา/u);
  assert.match(event.descriptionKh, /ជំហររបស់មន្ត្រីកម្ពុជា/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยัน/u);
  assert.match(event.descriptionKh, /មិនបានផ្ទៀងផ្ទាត់/u);
});

test("captured AKP evidence records the same claimed deployment and legal attribution", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === akpId);
  assert.ok(article);
  assert.equal(article.source, "AKP");
  assert.equal(article.credibility, 60);
  assert.equal(article.provenanceId, "cambodia-cmaa-cluster-munitions-preah-vihear-2025-12-14");
  assert.match(article.summary, /03:10 on December 14/u);
  assert.match(article.summary, /December 15 letter/u);
  assert.match(article.summary, /Cambodian official claims/u);
  assert.match(article.summary, /does not independently verify/u);
});
