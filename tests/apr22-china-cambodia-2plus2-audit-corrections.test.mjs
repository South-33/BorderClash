import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks75qq5e6x3dq40zf7ghga6ctd85bdkt";
const primaryEvidenceId = "f840561bd222e5d59a45708c735dd4e8";

test("Apr 22 China-Cambodia 2+2 row is date-only and grounded in the primary meeting record", () => {
  const row = readJsonl("data/timeline/2026-04.jsonl").find((item) => item.id === eventId);
  assert.ok(row);
  assert.equal(row.date, "2026-04-22");
  assert.equal(row.timeOfDay, "");
  assert.match(row.title, /First Foreign-Defense '2\+2' Strategic Dialogue/u);
  assert.match(row.description, /first meeting/u);
  assert.match(row.description, /Wang Yi and Dong Jun/u);
  assert.match(row.description, /Prak Sokhonn and Tea Seiha/u);
  assert.match(row.description, /political and defense security cooperation/u);
  assert.match(row.description, /international and regional situations/u);
  assert.doesNotMatch(row.description, /alliance|external challenges/u);
  assert.deepEqual(row.evidenceIds, [primaryEvidenceId]);
});

test("Apr 22 2+2 localizations preserve participants and agenda", () => {
  const row = readJsonl("data/timeline/2026-04.jsonl").find((item) => item.id === eventId);
  assert.ok(row);
  assert.match(row.titleTh + row.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(row.titleKh + row.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [row.titleTh, row.titleKh, row.descriptionTh, row.descriptionKh]) {
    assert.match(text, /2\+2/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
  assert.match(row.descriptionTh, /หวัง อี้/u);
  assert.match(row.descriptionTh, /ต่ง จวิน/u);
  assert.match(row.descriptionKh, /Wang Yi/u);
  assert.match(row.descriptionKh, /Dong Jun/u);
  assert.match(row.descriptionTh, /ปรัก สุคน/u);
  assert.match(row.descriptionTh, /เตีย เซ็ยฮา/u);
  assert.match(row.descriptionKh, /ប្រាក់ សុខុន/u);
  assert.match(row.descriptionKh, /ទៀ សីហា/u);
});

test("China MFA evidence records the first 2+2 meeting on Apr 22", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === primaryEvidenceId);
  assert.ok(article);
  assert.equal(article.source, "Ministry of Foreign Affairs of China");
  assert.equal(article.credibility, 100);
  assert.match(article.summary, /April 22, 2026/u);
  assert.match(article.summary, /Wang Yi and Dong Jun/u);
  assert.match(article.summary, /Prak Sokhonn and Tea Seiha/u);
});
