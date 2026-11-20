import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73ad0j0gehwk04n2ccxd95f9813e8g";
const articleId = "k975mhcmndh0841ebjtzmx5t6d7ym3vj";

test("WHO PHSA milestone uses the report date, not the January landing-page date", () => {
  const december = readJsonl("data/timeline/2025-12.jsonl");
  const january = readJsonl("data/timeline/2026-01.jsonl");
  const event = december.find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [articleId]);
  assert.equal(january.some((row) => row.id === eventId), false);
});

test("WHO copy keeps the source's rounding and national figures distinct", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /over 498,000 people/u);
  assert.match(event.description, /over 490,000/u);
  assert.match(event.description, /more than 151,000 families/u);
  assert.match(event.description, /18 Cambodian civilian deaths and 79 injuries/u);
  assert.match(event.description, /52 health facilities closed in Cambodia/u);
  assert.match(event.description, /different definitions/u);
  assert.match(event.description, /should not be summed/u);
});

test("Thai and Khmer copy preserve date, counts, and non-combined framing", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    for (const value of ["151,000", "498,000", "490,000", "18", "79", "52"]) {
      assert.match(text, new RegExp(value, "u"));
    }
    assert.doesNotMatch(text, /�/u);
  }
  assert.match(event.descriptionTh, /ไม่ควรนำมารวมเป็นยอดไทย-กัมพูชา/u);
  assert.match(event.descriptionKh, /មិនគួរបូកជាចំនួនសរុបថៃ-កម្ពុជា/u);
});

test("stored WHO article distinguishes document date from landing-page publication", () => {
  const article = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.source, "World Health Organization");
  assert.equal(article.credibility, 90);
  assert.match(article.summary, /dated December 18, 2025/u);
  assert.match(article.summary, /landing page was posted on January 5, 2026/u);
  assert.match(article.summary, /different definitions/u);
});
