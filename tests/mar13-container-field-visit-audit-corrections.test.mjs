import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const keptId = "ks7607a4n7x2x96vvts9aqb41d82ttxj";
const mergedId = "ks7bjvsqzpdywqbhpe67x0fgmn82xw5h";
const freshId = "jn7f65m1fenf0e3a04n4f07h8982vhjg";
const ktId = "jn7b4xqhmr44xw7d9h3zc93ns182wfc0";

test("March 13 field visit keeps the stable event id and drops the unsupported exact time", () => {
  const rows = readJsonl("data/timeline/2026-03.jsonl");
  const event = rows.find((row) => row.id === keptId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-13");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [freshId, ktId]);
  assert.equal(rows.some((row) => row.id === mergedId), false);
});

test("container snapshot preserves observed counts while attributing the territorial figure", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === keptId);
  assert.ok(event);
  assert.match(event.description, /March 13.*Fresh News team/u);
  assert.match(event.description, /105.*20 locations/u);
  assert.match(event.description, /about 760 hectares/u);
  assert.match(event.description, /territorial figure is a Cambodian claim/u);
  assert.match(event.description, /not an independently settled boundary/u);
});

test("Thai and Khmer copy preserve date, counts and territorial uncertainty", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === keptId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /13/u);
    assert.match(text, /105/u);
    assert.match(text, /20/u);
    assert.match(text, /760/u);
    assert.doesNotMatch(text, /���|\?{3,}/u);
  }
  assert.match(event.descriptionTh, /ข้อกล่าวอ้างของฝ่ายกัมพูชา/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់ភាគីកម្ពុជា/u);
});

test("March 14 picture report remains news context rather than a second dated deployment event", () => {
  const news = readJsonl("data/news/2026-03.jsonl");
  const fresh = news.find((row) => row.id === freshId);
  const kt = news.find((row) => row.id === ktId);
  assert.ok(fresh);
  assert.ok(kt);
  assert.equal(kt.credibility, 60);
  assert.match(fresh.summary, /directly visited.*March 13/u);
  assert.match(kt.summary, /March 14 image report/u);
  assert.match(kt.summary, /does not by itself establish.*newly occurred on March 14/u);
});
