import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks76w5qam9rk0trwyt2pfhaw0185nm80";
const evidenceId = "aa19aebde38adba0bc736d5e917f6373";

test("Australian mine-action pledge is dated to the captured April 24 meeting", () => {
  const event = read("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-24");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("pledge uses source-supported AUD amount and scope", () => {
  const event = read("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /AUD 1\.5 million/u);
  assert.match(event.description, /clearing remnants of past conflicts/u);
  assert.match(event.description, /border communities/u);
  assert.match(event.description, /does not state a fixed US-dollar value/u);
});

test("Thai and Khmer copies remove exact time and preserve AUD amount", () => {
  const event = read("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("1.5"));
    assert.ok(!value.includes("10:00"));
  }
});
