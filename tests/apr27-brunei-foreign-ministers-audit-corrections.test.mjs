import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks72qecfb0yr2awgcp36tcg25d85q4gy";
const duplicateId = "ks76v9wf899689c5ns0cryj7cx85sfzs";
const thaiMfaId = "0768f8ec62adcff0a91d7e3f539cfdc9";
const xinhuaId = "jn7fzw4kc756wbq0rt4n7qmygn85rpxq";

test("Apr 27 Brunei meeting is one date-only ceasefire and trust-building event", () => {
  const rows = readJsonl("data/timeline/2026-04.jsonl");
  const event = rows.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(rows.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-04-27");
  assert.ok(!event.timeOfDay);
  assert.match(event.title, /Reaffirm Ceasefire in Brunei/u);
  assert.match(event.description, /existing bilateral mechanisms/u);
  assert.match(event.description, /rebuilding mutual trust/u);
  assert.match(event.description, /misinformation and disinformation/u);
  assert.match(event.description, /confidence-building measures/u);
  assert.doesNotMatch(event.title + event.description, /Formally Notifies|officially communicate the termination/u);
  assert.doesNotMatch(event.description, /May 5|MOU 44|border security and management/u);
  assert.deepEqual(event.evidenceIds, [thaiMfaId, xinhuaId]);
});

test("Thai and Khmer copy preserve meeting date, ceasefire and trust-building", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /27/u);
    assert.doesNotMatch(text, /MOU 44/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
});

test("Thai MFA primary readout is stored as evidence", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === thaiMfaId);
  assert.ok(article);
  assert.equal(article.source, "Ministry of Foreign Affairs of Thailand");
  assert.equal(article.credibility, 100);
  assert.match(article.summary, /consolidation of the December 27 ceasefire/u);
  assert.match(article.summary, /rebuilding mutual trust/u);
});

test("Xinhua summary contains only claims present in its captured report", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === xinhuaId);
  assert.ok(article);
  assert.match(article.summary, /confidence-building measures/u);
  assert.match(article.summary, /international law/u);
  assert.doesNotMatch(article.summary, /MOU 44|revok|UNCLOS/iu);
});
