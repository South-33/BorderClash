import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78qm3mtv1dxm6zvtnhbzed7n83y56f";
const thaiRathId = "8e2a03f8c309865c2a9f43665dad4e33";
const tv5Id = "js741kx9aj9939e08h8ced5cxd83ybfg";
const provenanceId = "rtarf-chanthaburi-fence-update-2026-03-17";

test("Chanthaburi fence milestone uses the March 17 preparation update, not the March 18 publication date", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-17");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [thaiRathId, tv5Id]);
  assert.match(event.title, /Ready for April Construction/u);
  assert.match(event.description, /scheduled to begin in early April/u);
  assert.match(event.description, /not the start of the permanent wall/u);
});

test("localized copy preserves site preparation versus future wall construction", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /กำหนดเริ่มต้นเดือนเมษายน/u);
  assert.match(event.descriptionTh, /ไม่ใช่การเริ่มสร้างกำแพงถาวร/u);
  assert.match(event.descriptionKh, /គ្រោងចាប់ផ្តើមនៅដើមខែមេសា/u);
  assert.match(event.descriptionKh, /មិនមែនជាការចាប់ផ្តើមសាងសង់ជញ្ជាំងអចិន្ត្រៃយ៍ទេ/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("March 17 reports share provenance and preserve the April schedule", () => {
  const articles = readJsonl("data/news/2026-03.jsonl");
  const thaiRath = articles.find((row) => row.id === thaiRathId);
  const tv5 = articles.find((row) => row.id === tv5Id);
  assert.ok(thaiRath);
  assert.ok(tv5);
  assert.equal(thaiRath.provenanceId, provenanceId);
  assert.equal(tv5.provenanceId, provenanceId);
  assert.match(thaiRath.summary, /March 17/u);
  assert.match(thaiRath.summary, /scheduled to begin in early April/u);
  assert.match(tv5.summary, /on March 17/u);
  assert.match(tv5.summary, /scheduled to begin in early April 2026/u);
});
