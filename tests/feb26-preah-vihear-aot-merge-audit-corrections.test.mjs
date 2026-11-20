import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const survivorId = "ks7d7w2gtgfvjza2zgr2kzd0pn81z05y";
const duplicateId = "ks7fjhpr1gh3cp6s48zk98kjqd822va0";
const khmerTimesId = "jn7ftcrnrm75etb47smk5rwefx822pbz";
const cppId = "jn761aq97safz9078r3fwfg7p181zg3x";

test("February 26 AOT milestones are merged into the stronger surviving record", () => {
  const rows = read("data/timeline/2026-02.jsonl");
  const event = rows.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(rows.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-02-26");
  assert.equal(event.timeOfDay, "10:00");
  assert.deepEqual(event.evidenceIds, [khmerTimesId, cppId]);
});

test("survivor preserves An Seh detail while attributing damage claims", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.match(event.title, /Cambodian Government Accounts Say/u);
  assert.match(event.description, /Cambodia's Ministry of National Defence said/u);
  assert.match(event.description, /An Seh village/u);
  assert.match(event.description, /Cambodian authorities said/u);
  assert.match(event.description, /do not independently verify attribution/u);
});

test("Thai and Khmer copies preserve time, second location, and uncertainty", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.match(event.titleTh, /รายงานรัฐบาลกัมพูชา/u);
  assert.match(event.titleKh, /របាយការណ៍រដ្ឋាភិបាលកម្ពុជា/u);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.match(value, /10:00/u);
  }
  assert.match(event.descriptionTh, /อานเซฮ์/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /អានសេះ/u);
  assert.match(event.descriptionKh, /មិនបានផ្ទៀងផ្ទាត់ដោយឯករាជ្យ/u);
});

test("CPP evidence summary keeps the Cambodian claimant with the damage allegation", () => {
  const article = read("data/news/2026-02.jsonl").find((row) => row.id === cppId);
  assert.ok(article);
  assert.match(article.summary, /Cambodian authorities described as heavily damaged/u);
  assert.match(article.summary, /government also reiterated its allegation/u);
});
