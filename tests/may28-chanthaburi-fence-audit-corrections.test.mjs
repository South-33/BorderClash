import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks70hcayzddx4z1yqy62e7deb587rhw2";

test("May 28 fence row removes unsupported exact time", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-28");
  assert.equal(event.timeOfDay, undefined);
});

test("inspection date is separated from the later 20 percent status", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /inspected the pilot border-fence project/u);
  assert.match(event.description, /published later/u);
  assert.match(event.description, /does not establish that the 20% figure applied/u);
  assert.match(event.description, /no exact inspection time/u);
});

test("Thai and Khmer copies preserve chronology uncertainty", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("20"));
    assert.ok(value.includes("28"));
    assert.ok(!value.includes("10:30"));
  }
});
