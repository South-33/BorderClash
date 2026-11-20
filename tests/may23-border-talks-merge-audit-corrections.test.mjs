import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const retainedId = "ks7dzb5q7nf7pwwbmk581v5pw9878y2f";
const mergedId = "ks77xz4hj6rbwackk2dk9f32x187dscz";
const evidenceIds = [
  "js77pcbdr8vmmzag45rzxpc69d8782za",
  "jn7a944hnftqt9n2wavgtejzwh878x5v",
  "k9792rs7bmx16f3y0y5cz41zbx87dez0",
];
const provenanceId = "tea-seiha-border-talks-2026-05-23";

test("May 23 retains the Tea Seiha border-talk milestone and removes the duplicate May 24 row", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const retained = timeline.find((row) => row.id === retainedId);
  assert.ok(retained);
  assert.equal(retained.date, "2026-05-23");
  assert.equal(retained.timeOfDay, "");
  assert.deepEqual(retained.evidenceIds, evidenceIds);
  assert.match(retained.description, /May 25 Khmer Times follow-up repeated Tea Seiha's welcome/u);
  assert.match(retained.description, /does not establish a separate May 24/u);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
});

test("localized copy preserves the duplicate-versus-follow-up distinction", () => {
  const retained = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === retainedId);
  assert.ok(retained);
  assert.match(retained.descriptionTh, /วันที่ 25 พฤษภาคมกล่าวซ้ำจุดยืนเดิม/u);
  assert.match(retained.descriptionTh, /ไม่ได้ยืนยันเหตุเจรจาชายแดนใหม่ในวันที่ 24 พฤษภาคม/u);
  assert.match(retained.descriptionKh, /ថ្ងៃទី 25 ខែឧសភា បានរំលឹកជំហរដដែល/u);
  assert.match(retained.descriptionKh, /មិនបញ្ជាក់ពីព្រឹត្តិការណ៍ចរចាព្រំដែនថ្មីនៅថ្ងៃទី 24 ខែឧសភាទេ/u);
  assert.doesNotMatch(retained.descriptionTh, /�/u);
  assert.doesNotMatch(retained.descriptionKh, /�/u);
});

test("all retained border-talk articles share the May 23 Tea Seiha provenance", () => {
  const articles = readJsonl("data/news/2026-05.jsonl");
  for (const id of evidenceIds) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId);
  }
  const followUp = articles.find((row) => row.id === evidenceIds[2]);
  assert.match(followUp.summary, /May 25 Khmer Times follow-up/u);
  assert.match(followUp.summary, /rather than establishing a separate May 24 diplomatic milestone/u);
});
