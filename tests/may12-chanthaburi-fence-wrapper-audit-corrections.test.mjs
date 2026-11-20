import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7fkq5mhz4zyjhe7tgkngd4t185ee9b";
const wrapperId = "ks79nkwqwsjgxvr8m5rxfz0s5h86y9fv";
const standardId = "js7eaj7f16hx4nrmwg1hhtd60n85g93y";
const tnaId = "de5f2a1561df1ad8e6b06d651f97142b";

test("May 12 fence-start wrapper is merged into the April 24 Thai milestone", () => {
  const april = readJsonl("data/timeline/2026-04.jsonl");
  const may = readJsonl("data/timeline/2026-05.jsonl");
  const event = april.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-24");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(may.some((row) => row.id === wrapperId), false);
  assert.deepEqual(event.evidenceIds, [standardId, tnaId]);
});

test("surviving copy distinguishes the April 24 announcement from the late-April pilot start", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /On April 24/u);
  assert.match(event.description, /had begun along the Thai-Cambodian/u);
  assert.match(event.description, /1,310 metres/u);
  assert.match(event.description, /begun in late April/u);
  assert.doesNotMatch(event.description, /May 12/u);
  assert.doesNotMatch(event.description, /14:00/u);
});

test("Thai and Khmer copy preserve the late-April Chanthaburi chronology", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.descriptionTh, /24 เมษายน/u);
  assert.match(event.descriptionTh, /ปลายเดือนเมษายน/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 24 ខែមេសា/u);
  assert.match(event.descriptionKh, /ចុងខែមេសា/u);
});

test("captured TNA follow-up explicitly says the first phase began in late April", () => {
  const article = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === tnaId);
  assert.ok(article);
  assert.equal(article.source, "Pattaya Mail / TNA");
  assert.match(article.summary, /begun in late April 2026/u);
  assert.match(article.summary, /1,310-metre/u);
  assert.match(article.summary, /45 days/u);
});
