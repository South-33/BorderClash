import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7b111hwgygajmegf8vb8yc6d88xp3g";
const evidenceId = "a66932105adc5e222629530eabcb1c26";

test("Anutin tank denial uses the captured June 15 16:10 briefing time", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-15");
  assert.equal(event.timeOfDay, "16:10");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("row says no reports rather than asserting tank movements as fact", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /said there were none/u);
  assert.match(event.description, /inside its own territory/u);
  assert.doesNotMatch(event.description, /not discussed at the National Security Council/u);
});

test("Thai and Khmer copies preserve the exact supported briefing time", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event.descriptionTh.includes("16:10"));
  assert.ok(event.descriptionKh.includes("16:10"));
});
