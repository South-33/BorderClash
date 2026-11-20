import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks75d154ytnnnk2862w3qqmhp989qa0k";
const evidenceId = "8128c3e90ddf0692371fc5d789f5b916";

test("July 1 AOT Chanthaburi visit removes unsupported noon time", () => {
  const event = read("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-01");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("row preserves the captured fence-inspection scope", () => {
  const event = read("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /nine ASEAN Observer Team-Thailand delegates/u);
  assert.match(event.description, /boundary markers 52 and 59/u);
  assert.match(event.description, /began in the morning/u);
  assert.match(event.description, /does not give an exact event time/u);
});

test("Thai and Khmer copies keep morning-only timing", () => {
  const event = read("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.doesNotMatch(event.descriptionTh, /12:00/u);
  assert.doesNotMatch(event.descriptionKh, /12:00/u);
  assert.match(event.descriptionTh, /ช่วงเช้า/u);
  assert.match(event.descriptionKh, /ពេលព្រឹក/u);
});
