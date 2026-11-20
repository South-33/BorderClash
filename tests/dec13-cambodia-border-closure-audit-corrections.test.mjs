import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Cambodia-wide border suspension uses the Dec 13 decision date without invented time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find(
    (row) => row.id === "ks78xjqgbmv5wxdksp08er3xk1813xx7",
  );

  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Until Further Notice/u);
  assert.doesNotMatch(event.title, /Indefinitely/u);
  assert.match(event.description, /Ministry of Interior announced/u);
  assert.match(event.description, /claim that remains Cambodia's position/u);
  assert.deepEqual(event.evidenceIds, [
    "jn36e3a415f98cc4f33ceafd6393641b",
    "jn7a5b3bdskywpxyh6whece1717x87ma",
  ]);
});

test("Thai and Khmer descriptions preserve the Dec 13 date and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find(
    (row) => row.id === "ks78xjqgbmv5wxdksp08er3xk1813xx7",
  );

  assert.ok(event);
  assert.match(event.descriptionTh, /13 ธันวาคม/u);
  assert.match(event.descriptionTh, /ข้อกล่าวหาของฝ่ายกัมพูชา/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 13 ខែធ្នូ/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់ភាគីកម្ពុជា/u);
});
