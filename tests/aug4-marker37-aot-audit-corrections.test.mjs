import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7d92z88t0ahq9x9hra1d2kah8c512a";

test("August 4 marker-37 visit removes unsupported 09:21", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-08-04");
  assert.equal(event.timeOfDay, undefined);
});

test("visit is attributed to Cambodian Defence Ministry reporting", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.match(event.title, /Cambodian Defence Ministry Says/u);
  assert.match(event.description, /quoting Cambodia's Ministry of National Defence/u);
  assert.match(event.description, /Those legal and boundary positions are Cambodia's account/u);
});

test("unsupported ceasefire-compliance purpose is removed", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /does not describe the visit as a ceasefire-compliance inspection/u);
  assert.doesNotMatch(event.description, /monitored conditions to verify ceasefire compliance/u);
});

test("Thai and Khmer copies preserve attribution and no exact time", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("37"));
    assert.ok(!value.includes("09:21"));
  }
});
