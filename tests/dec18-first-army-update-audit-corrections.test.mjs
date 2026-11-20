import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Dec 18 Sa Kaeo row follows the First Army 18:00 situation update", () => {
  const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8")
    .trim()
    .split(/\r?\n/u)
    .map(JSON.parse);
  const event = timeline.find((item) => item.id === "ks7dfeqrn3t9rc032vk9x92wdd812hgv");

  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, "18:00");
  assert.deepEqual(event.evidenceIds, ["d7b20e3c964b4f64564540f89c3475e4"]);
  assert.match(event.description, /Ban Khlong Phaeng/u);
  assert.match(event.description, /BM-21 rockets/u);
  assert.match(event.description, /64 wounded and four killed/u);
  assert.match(event.description, /attributed to the Thai military/u);
  assert.doesNotMatch(event.description, /verified destruction|confirmed Cambodian losses/u);
});
