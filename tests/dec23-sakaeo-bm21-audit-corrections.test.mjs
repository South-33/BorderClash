import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7eabm14hmqdv7bbb3273bgh98131c3";
const evidenceId = "js7a16g6xtvqr18cf8kew0rf817xwrx5";

test("Dec 23 Sa Kaeo row is the supported 14:00 Thai briefing, not a conflated cross-border event", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, "14:00");
  assert.match(event.title, /Thai Army Says/u);
  assert.match(event.title, /Nearly 200 BM-21 Rockets/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /evening of December 22 through the morning of December 23/u);
  assert.match(event.description, /40 homes/u);
  assert.match(event.description, /more than 7 civilians/u);
  assert.match(event.description, /Thai military account/u);
  assert.match(event.description, /does not independently verify/u);
  assert.doesNotMatch(event.description, /Preah Vihear|Poipet|10:30/iu);
});

test("Thai and Khmer keep the same time, numbers, actor attribution, and uncertainty", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["14:00", "22", "23", "200", "BM-21", "40", "7"]) {
    assert.ok(event.descriptionTh.includes(value), `Thai: ${value}`);
    assert.ok(event.descriptionKh.includes(value), `Khmer: ${value}`);
  }
  assert.match(event.descriptionTh, /ฝ่ายทหารไทย/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /យោធាថៃ/u);
  assert.match(event.descriptionKh, /មិនបានផ្ទៀងផ្ទាត់ដោយឯករាជ្យ/u);
  assert.doesNotMatch(event.descriptionTh, /พระวิหาร|ปอยเปต|10:30/u);
  assert.doesNotMatch(event.descriptionKh, /ព្រះវិហារ|ប៉ោយប៉ែត|10:30/u);
});

test("cited Naewna evidence remains an attributed Thai military report", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.credibility, 60);
  assert.match(article.titleEn, /nearly 200 BM-21 rockets/u);
  assert.match(article.summary, /Army reported/u);
});
