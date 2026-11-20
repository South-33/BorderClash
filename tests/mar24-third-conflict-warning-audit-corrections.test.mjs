import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7cjymrv5nwhdvhqsymtbatph84gnm6";
const duplicateId = "ks7fkdwq2rth2mv6w8z34x2q9188x2wj";
const thaiPbsId = "cb17ab27709c4b63c73fb1f7113f5ab2";
const cambodiaModId = "c8d6bf77598f8e947cca0f8a0ea82952";
const warningProvenance = "teeranan-facebook-mar24-third-conflict-warning";
const denialProvenance = "cambodia-mod-mar24-third-conflict-denial";

test("duplicate Mar 24 warning rows are merged and the event is date-only", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-03-24");
  assert.equal(event.timeOfDay ?? "", "");
  assert.deepEqual(event.evidenceIds, [thaiPbsId, cambodiaModId]);
});

test("warning and denial remain attributed and unsupported drone deployment is removed", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /He cited what he described as Cambodia's large weapons purchases/u);
  assert.match(event.description, /Cambodia's Ministry of National Defence rejected/u);
  assert.match(event.description, /does not independently establish/u);
  assert.doesNotMatch(event.description, /FPV/u);
  assert.doesNotMatch(event.description, /deployed.*drone/iu);
  assert.doesNotMatch(event.description, /14:00/u);
});

test("English Thai and Khmer preserve the same attribution and denial", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /24/u);
    assert.match(event[field], /2027/u);
    assert.match(event[field], /Teeranan Nandhakwang/u);
  }
  assert.match(event.descriptionTh, /ไม่ถูกต้องและไร้มูลฐาน/u);
  assert.match(event.descriptionKh, /មិនត្រឹមត្រូវ និងគ្មានមូលដ្ឋាន/u);
});

test("reports repeating the same underlying statements share provenance", () => {
  const articles = readJsonl("data/news/2026-03.jsonl");
  const byId = new Map(articles.map((row) => [row.id, row]));
  for (const id of [thaiPbsId, "js76e8v0mqs8zfqayeqmbbnsf183svm8", "k97exsnezrj5z5q8hjcjjasxe183g5r7", "js7dewfxs2dmbpat8y8k05b4rn83hmgn", "js78ads5jveb0jjbpsw390nngd83m8hz"]) {
    assert.equal(byId.get(id)?.provenanceId, warningProvenance);
  }
  for (const id of [cambodiaModId, "js7ap1jdchrc3gcjpsvpqnsgfx83mwg2", "jn78stm93fgfq4ybcqp50sy40983q3wn", "jn70bfx0kz68z0vyk1rj912zx583kh4g", "jn79wcm63myqmjkqa0kb5wt0m183mmwz"]) {
    assert.equal(byId.get(id)?.provenanceId, denialProvenance);
  }
});
