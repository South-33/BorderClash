import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks73y88ss4stmzfthhf9cgybjx812241";
const duplicateId = "ks7d2vgbc8nzvkfdhajqsdqtwd812695";
const primaryId = "55d6eb1e288cf629e54f1b1e1eae8f74";
const siamNewsId = "js719k937ktk28ez04bcp3cx497xa74x";
const chinaDailyId = "k9779vfvs10tghtkwn8ga5qavd7xfjwn";
const unusableThaiPostId = "js72wgedbzrgtjp24j8hnbtee97xdv13";
const provenanceId = "china-mfa-guo-dec15-border-ceasefire";

test("China ceasefire appeal is one December 15 milestone without invented exact time", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.importance, 72);
  assert.match(event.title, /China Foreign Ministry Urges Ceasefire/u);
  assert.match(event.description, /December 15 regular press conference/u);
  assert.match(event.description, /maximum restraint/u);
  assert.match(event.description, /protect civilians/u);
  assert.deepEqual(event.evidenceIds, [primaryId, siamNewsId, chinaDailyId]);
  assert.equal(event.evidenceIds.includes(unusableThaiPostId), false);
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
});

test("English, Thai and Khmer preserve the December 15 attribution and chronology", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === survivorId);
  assert.match(event.description, /Guo Jiakun/u);
  assert.match(event.descriptionTh, /15 ธันวาคม/u);
  assert.match(event.descriptionTh, /กัว เจียคุน/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 15 ខែធ្នូ/u);
  assert.match(event.descriptionKh, /Guo Jiakun/u);
  assert.doesNotMatch(event.descriptionTh, /วันที่ 17 ธันวาคม.*คำเรียกร้องหยุดยิงครั้งใหม่/u);
});

test("direct and reproduced reports share one December 15 Foreign Ministry provenance chain", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const primary = news.find((row) => row.id === primaryId);
  const siamNews = news.find((row) => row.id === siamNewsId);
  const chinaDaily = news.find((row) => row.id === chinaDailyId);
  assert.ok(primary);
  assert.ok(siamNews);
  assert.ok(chinaDaily);
  assert.equal(primary.provenanceId, provenanceId);
  assert.equal(siamNews.provenanceId, provenanceId);
  assert.equal(chinaDaily.provenanceId, provenanceId);
  assert.equal(new Date(primary.publishedAt).toISOString(), "2025-12-15T09:50:00.000Z");
  assert.match(primary.summary, /December 15 regular press conference/u);
  assert.match(siamNews.summary, /December 15 regular press-conference remarks/u);
  assert.equal(new Date(chinaDaily.publishedAt).toISOString().slice(0, 10), "2025-12-17");
  assert.match(chinaDaily.summary, /Monday, December 15/u);
  assert.match(chinaDaily.summary, /later coverage of the December 15 statement/u);
});
