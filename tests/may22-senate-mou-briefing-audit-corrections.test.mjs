import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks74kter2wmn9a0q8w9024zy09876ycf";
const thaiRathId = "b11e2cbc0eaf1af27f5e35f5ada4ae48";
const khaosodId = "k976zbfvmwp3k9n1s3hmfk9ke9876ya7";
const matichonId = "js724sedjnqvs4nyv855h38aj9876w0e";
const provenanceId = "thai-senate-mou-briefing-2026-05-22";

test("May 22 Senate briefing is a committee recommendation, not a completed government revocation", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-22");
  assert.equal(event.timeOfDay, "11:30");
  assert.deepEqual(event.evidenceIds, [thaiRathId, khaosodId, matichonId]);
  assert.match(event.title, /Recommendation to End Border MOUs/u);
  assert.match(event.description, /unanimous recommendation/u);
  assert.match(event.description, /future Thai government/u);
  assert.match(event.description, /not a completed government revocation/u);
});

test("Thai and Khmer copy preserve the committee-versus-government distinction", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /มติเอกฉันท์ของคณะกรรมาธิการที่เสนอให้ไทยยกเลิก/u);
  assert.match(event.descriptionTh, /หากรัฐบาลไทยในอนาคตยกเลิก/u);
  assert.match(event.descriptionTh, /ไม่ใช่การยกเลิกโดยรัฐบาลที่เสร็จสิ้นแล้ว/u);
  assert.match(event.descriptionKh, /អនុសាសន៍ជាឯកច្ឆន្ទរបស់គណៈកម្មាធិការ/u);
  assert.match(event.descriptionKh, /ប្រសិនបើរដ្ឋាភិបាលថៃនាពេលអនាគតលុបចោល/u);
  assert.match(event.descriptionKh, /មិនមែនជាការលុបចោលដែលរដ្ឋាភិបាលបានអនុវត្តរួចហើយទេ/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("May 22 reports share provenance and no longer assert a completed Thai decision", () => {
  const articles = readJsonl("data/news/2026-05.jsonl");
  const thaiRath = articles.find((row) => row.id === thaiRathId);
  const khaosod = articles.find((row) => row.id === khaosodId);
  const matichon = articles.find((row) => row.id === matichonId);
  assert.ok(thaiRath);
  assert.ok(khaosod);
  assert.ok(matichon);
  for (const article of [thaiRath, khaosod, matichon]) {
    assert.equal(article.provenanceId, provenanceId);
  }
  assert.match(thaiRath.summary, /at 11:30 on May 22/u);
  assert.match(khaosod.summary, /future Thai government/u);
  assert.match(matichon.summary, /committee recommendation/u);
  assert.doesNotMatch(khaosod.summary, /Thailand's decision to revoke/u);
  assert.doesNotMatch(matichon.summary, /Thailand's decision to cancel/u);
});
