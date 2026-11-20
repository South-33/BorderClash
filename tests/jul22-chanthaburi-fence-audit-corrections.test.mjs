import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks79e6tamfhvaqmepj2cjh0c218b4wnf";
const thairathId = "4c32b8981e6aab396931fc88b354212e";
const reutersId = "k970nssx5sqej4z0qtt9wmz0dh8b4fz5";

test("July 22 fence milestone uses the inspection time and detailed progress briefing", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-22");
  assert.equal(event.timeOfDay, "13:00");
  assert.deepEqual(event.evidenceIds, [thairathId, reutersId]);
  assert.match(event.title, /78\.56% Complete/u);
  assert.match(event.description, /78\.56% complete/u);
  assert.match(event.description, /350 metres were complete except for finishing work/u);
  assert.match(event.description, /410 metres remained under construction/u);
});

test("timeline preserves the same-day source discrepancy instead of asserting completion", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Reuters reported the same day that Thailand had completed the first section/u);
  assert.match(event.description, /detailed Thai briefing showed construction was still ongoing/u);
  assert.doesNotMatch(event.title, /Completes First Permanent/u);
});

test("Thai and Khmer copy preserve time, progress and ongoing-construction caveat", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /13:00/u);
    assert.match(text, /78\.56%/u);
    assert.match(text, /350/u);
    assert.match(text, /450/u);
    assert.match(text, /410/u);
    assert.doesNotMatch(text, /���|\?{3,}/u);
  }
  assert.match(event.descriptionTh, /งานยังดำเนินอยู่/u);
  assert.match(event.descriptionKh, /ការសាងសង់នៅតែបន្ត/u);
});

test("Reuters syndication is identified and Thairath remains the detailed progress source", () => {
  const articles = readJsonl("data/news/2026-07.jsonl");
  const thairath = articles.find((row) => row.id === thairathId);
  const reuters = articles.find((row) => row.id === reutersId);
  assert.ok(thairath);
  assert.ok(reuters);
  assert.equal(thairath.credibility, 80);
  assert.equal(reuters.source, "The Straits Times / Reuters");
  assert.match(thairath.summary, /78\.56% complete/u);
  assert.match(reuters.summary, /Reuters reported/u);
});
