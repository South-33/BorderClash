import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7av312vd5n721qey2dk6d895812fhg";
const evidenceId = "k970782472qqa2wcbmbz962tv57xe6tr";

test("Dec 17 bilateral casualty snapshot is cumulative and date-only", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.category, "humanitarian");
  assert.match(event.title, /Yeni Şafak Reports Combined Death Toll at Least 52/u);
  assert.match(event.description, /19 soldiers and 16 civilians/u);
  assert.match(event.description, /17 civilian deaths/u);
  assert.match(event.description, /cumulative totals/u);
  assert.match(event.description, /does not independently verify each death/u);
  assert.doesNotMatch(event.title + event.description, /57|38 fatalities|21 soldiers|Hill 350|1,000 rai|100 incoming/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Dec 17 bilateral casualty snapshot stays aligned across Thai and Khmer", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Thailand–Cambodia/u);
  assert.doesNotMatch(event.title + event.description, /\?|�/u);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.doesNotMatch(text, /\?|�/u);
    assert.match(text, /52/u);
    assert.match(text, /19/u);
    assert.match(text, /16/u);
    assert.match(text, /17/u);
  }
});
