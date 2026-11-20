import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const targetId = "ks7765t4rtzfk5wczvfpszv31x812xfw";
const evidenceId = "d4de1c981b5299001b2b209bdaf77f5d";
const dec13Id = "ks7db354hhf9hr0tm1wphvmfhh812p3j";

test("Dec 12 Poipet return row uses the captured 19:55 police update", () => {
  const row = readJsonl("data/timeline/2025-12.jsonl").find((item) => item.id === targetId);
  assert.ok(row);
  assert.equal(row.date, "2025-12-12");
  assert.equal(row.timeOfDay, "19:55");
  assert.deepEqual(row.evidenceIds, [evidenceId]);
  assert.match(row.title, /^Khlong Luek Police Reports/u);
  assert.match(row.description, /Khlong Luek Police Station posted/u);
  assert.match(row.description, /two days without a response/u);
});

test("Dec 12 row no longer imports the Dec 13 indefinite-postponement milestone", () => {
  const row = readJsonl("data/timeline/2025-12.jsonl").find((item) => item.id === targetId);
  assert.match(row.description, /does not support the prior claim/u);
  assert.doesNotMatch(row.title, /Indefinitely/u);
  assert.doesNotMatch(row.description, /negotiations are stalled|fighting reported nearby/iu);
});

test("Thai and Khmer keep the report attribution and supported time", () => {
  const row = readJsonl("data/timeline/2025-12.jsonl").find((item) => item.id === targetId);
  for (const value of ["19:55", "12", "2"]) {
    assert.ok(row.descriptionTh.includes(value), `Thai ${value}`);
    assert.ok(row.descriptionKh.includes(value), `Khmer ${value}`);
  }
  assert.match(row.descriptionTh, /ตำรวจไทย/u);
  assert.match(row.descriptionKh, /ប៉ូលិសថៃ/u);
});

test("captured Thai Rath evidence is distinct from the Dec 13 MFA postponement record", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const article = news.find((item) => item.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "Thai Rath English");
  assert.equal(article.credibility, 80);
  assert.match(article.summary, /19:55/u);
  const dec13 = readJsonl("data/timeline/2025-12.jsonl").find((item) => item.id === dec13Id);
  assert.ok(dec13);
  assert.equal(dec13.date, "2025-12-13");
  assert.equal(dec13.timeOfDay, "15:00");
  assert.match(dec13.description, /postponed indefinitely/u);
});
