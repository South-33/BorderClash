import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks79rcnk1ae78yqwwhyemfcta583zzmv";
const duplicateId = "ks782q8tj1n9260p5bmv8d7hk1841ce9";
const evidenceId = "dead1297733ca69b64f5e1c5c1c1ed66";

test("94% displacement return milestone is anchored to March 13 government figures", () => {
  const rows = readJsonl("data/timeline/2026-03.jsonl");
  const event = rows.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-13");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.equal(rows.some((row) => row.id === duplicateId), false);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /morning of March 13/u);
  assert.match(event.description, /610,000/u);
  assert.match(event.description, /94%/u);
  assert.match(event.description, /more than 640,000/u);
  assert.match(event.description, /37,076/u);
  assert.match(event.description, /19,245/u);
  assert.match(event.description, /12,795/u);
  assert.match(event.description, /does not independently verify/u);
});

test("Thai and Khmer preserve the same March 13 displacement figures", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    for (const token of ["13", "610,000", "94%", "640,000", "37,076", "19,245", "12,795"]) {
      assert.ok(text.includes(token), `expected localized text to include ${token}`);
    }
  }
});

test("direct AKP evidence records the March 13 morning status", () => {
  const evidence = readJsonl("data/news/2026-03.jsonl").find((row) => row.id === evidenceId);
  assert.ok(evidence);
  assert.equal(evidence.provenanceId, "cambodia-government-mar13-displacement-return");
  assert.match(evidence.summary, /morning of March 13/u);
  assert.match(evidence.summary, /610,000/u);
  assert.match(evidence.summary, /37,076/u);
});
