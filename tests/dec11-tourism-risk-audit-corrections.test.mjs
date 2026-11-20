import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const targetId = "ks7c853x1ey6jthwkyadqnf261812ve6";

test("Dec 11 tourism record distinguishes future risk from observed cancellations", () => {
  const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8")
    .trim()
    .split(/\r?\n/u)
    .map(JSON.parse);
  const event = timeline.find((item) => item.id === targetId);

  assert.equal(event.date, "2025-12-11");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [
    "aa23a062f54e9bf1717c54b22a5266a2",
    "a9d17259c1a371b0533ef91fcc4caf12",
  ]);
  assert.match(event.description, /could deter future bookings/u);
  assert.match(event.description, /had not observed cancellations/u);
  assert.match(event.description, /travel across Thailand remained normal/u);
  assert.match(event.description, /seven border provinces/u);
  assert.doesNotMatch(event.description, /mass cancellations|causing mass cancellations/u);
});
