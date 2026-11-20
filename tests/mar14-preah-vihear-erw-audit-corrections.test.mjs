import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks75pgxv5d71b3snqz2d4a0te182y7f1";
const evidenceId = "jn776x6vjv60abtv577dc9fjd182yrc2";

test("Preah Vihear explosive-device count is anchored to the March 14 cutoff", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-14");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /1,300\+ Explosive Devices/u);
  assert.match(event.description, /through March 14/u);
  assert.match(event.description, /more than 1,300 explosive devices/u);
});

test("Thai origin is kept as an attributed Cambodian claim in all languages", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /He attributed the devices to Thai military bombardment/u);
  assert.match(event.description, /Cambodia's account, not an independently established finding/u);
  assert.match(event.descriptionTh, /เป็นคำกล่าวของฝ่ายกัมพูชา/u);
  assert.match(event.descriptionTh, /ไม่ใช่ข้อยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /ជាការរៀបរាប់របស់ភាគីកម្ពុជា/u);
  assert.match(event.descriptionKh, /មិនមែនជាការបញ្ជាក់ដោយឯករាជ្យ/u);
});

test("Khmer Times evidence records its March 16 publication date and source-defined cutoff", () => {
  const article = readJsonl("data/news/2026-03.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString(), "2026-03-16T07:00:00.000Z");
  assert.equal(article.provenanceId, "cambodia-mine-action-preah-vihear-erw-mar14-2026");
  assert.match(article.summary, /through March 14/u);
  assert.match(article.summary, /origin attribution is a Cambodian official claim/u);
});
