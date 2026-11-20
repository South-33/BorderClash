import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks72met1h7n5pc3ae29s6at11h88qrvy";
const evidenceId = "8e7ee4f05803d4e6cff7e41e2395b412";

test("Ta Kwai trial-opening row removes unsupported 08:00", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-13");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("row records the June 13-14 special opening without inventing a policy shift", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /held on June 13-14/u);
  assert.match(event.description, /does not establish an exact opening time/u);
  assert.match(event.description, /without characterizing the temporary opening as a broader change/u);
});

test("Thai and Khmer copies preserve the two-day window and no exact time", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("13-14"));
    assert.ok(!value.includes("08:00"));
  }
});
