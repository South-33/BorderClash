import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const sentencingId = "ks7bcwe72mtq3ctbs28xs6qmkh81yrfr";
const appealId = "ks7fjeenpqjs97b5t3jq7szj7d81njft";
const appellateId = "ks7575fht4r6s3v64ysy71mtyd83q0hs";

test("journalist sentencing uses the December 17 judgment date rather than HRW publication date", () => {
  const dec = readJsonl("data/timeline/2025-12.jsonl");
  const feb = readJsonl("data/timeline/2026-02.jsonl");
  const event = dec.find((row) => row.id === sentencingId);

  assert.ok(event);
  assert.equal(event.date, "2025-12-17");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.equal(feb.some((row) => row.id === sentencingId), false);
  assert.match(event.title, /14 Years for Treason/u);
  assert.match(event.description, /Siem Reap Provincial Court/u);
  assert.match(event.description, /Article 445/u);
  assert.match(event.description, /not publicly reported until February 2026/u);
  assert.deepEqual(event.evidenceIds, [
    "k97fwrnqh8arf7bpnba0rg62hn81zg67",
    "87961d8836c70f6d437278ba94a4bf5b",
    "b18554a9f086b4cd885849da6f77998d",
  ]);
});

test("English Thai and Khmer preserve the same sentencing facts", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === sentencingId);
  assert.ok(event);

  for (const text of [event.description, event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /17/u);
    assert.match(text, /2025/u);
    assert.match(text, /14/u);
    assert.match(text, /445/u);
    assert.match(text, /Phorn Sopheap/u);
    assert.match(text, /Pheap Pheara/u);
  }
});

test("later appeal and appellate ruling remain separate milestones", () => {
  const feb = readJsonl("data/timeline/2026-02.jsonl");
  const mar = readJsonl("data/timeline/2026-03.jsonl");
  assert.equal(feb.find((row) => row.id === appealId)?.date, "2026-02-16");
  assert.equal(mar.find((row) => row.id === appellateId)?.date, "2026-03-26");
});

test("captured chronology evidence explicitly supports December 17", () => {
  const news = readJsonl("data/news/2026-02.jsonl");
  const cpj = news.find((row) => row.id === "87961d8836c70f6d437278ba94a4bf5b");
  const licadho = news.find((row) => row.id === "b18554a9f086b4cd885849da6f77998d");
  const hrw = news.find((row) => row.id === "k97fwrnqh8arf7bpnba0rg62hn81zg67");

  assert.ok(cpj);
  assert.ok(licadho);
  assert.ok(hrw);
  assert.match(cpj.summary, /December 17, 2025/u);
  assert.match(licadho.summary, /December 17, 2025/u);
  assert.equal(hrw.category, "political");
  assert.match(hrw.summary, /one-day trial in December 2025/u);
});
