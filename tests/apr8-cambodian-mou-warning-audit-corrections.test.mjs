import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7706b7ynmpr0baxs1yrz3nbx84j5sv";
const evidenceId = "jn77zyh7y3xfmb8pwc5grsxg1184jq7z";

test("Cambodian MOU warning is dated to the April 8 MFA statement", () => {
  const row = readJsonl("data/timeline/2026-04.jsonl").find((item) => item.id === eventId);
  assert.ok(row);
  assert.equal(row.date, "2026-04-08");
  assert.equal(row.timeOfDay, "");
  assert.match(row.title, /^Cambodian MFA Warns/u);
  assert.match(row.description, /Cambodia's Foreign Ministry/u);
  assert.match(row.description, /deeply regrettable/u);
  assert.match(row.description, /cooperative spirit/u);
  assert.deepEqual(row.evidenceIds, [evidenceId]);
  assert.doesNotMatch(row.description, /Hun Manet|occupied territories|violat(?:e|es|ion) international law/u);
});

test("April 8 localizations preserve the MFA actor and MOU warning strength", () => {
  const row = readJsonl("data/timeline/2026-04.jsonl").find((item) => item.id === eventId);
  assert.ok(row);
  assert.match(row.titleTh + row.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(row.titleKh + row.descriptionKh, /[\u1780-\u17FF]/u);
  assert.doesNotMatch(row.titleTh + row.descriptionTh + row.titleKh + row.descriptionKh, /\?|�/u);
  assert.match(row.descriptionTh, /กระทรวงการต่างประเทศกัมพูชา/u);
  assert.match(row.descriptionKh, /ក្រសួងការបរទេសកម្ពុជា/u);
  for (const text of [row.descriptionTh, row.descriptionKh]) {
    assert.match(text, /8/u);
    assert.match(text, /2001/u);
  }
});

test("Khmer Times summary separates the MOU statement from Hun Manet's land-border remarks", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /April 8 Cambodian Foreign Ministry/u);
  assert.match(article.summary, /cooperative spirit/u);
  assert.match(article.summary, /separately reported Prime Minister Hun Manet/u);
});
