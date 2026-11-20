import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
const eventId = "ks7fkq5mhz4zyjhe7tgkngd4t185ee9b";

test("April 24 fence milestone stays date-only and separates policy from the late-April pilot", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-24");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.deepEqual(event.evidenceIds, ["js7eaj7f16hx4nrmwg1hhtd60n85g93y", "de5f2a1561df1ad8e6b06d651f97142b"]);
  assert.match(event.description, /fence work had begun/u);
  assert.match(event.description, /first-phase budgets had already been allocated to the armed forces/u);
  assert.match(event.description, /1,310 metres/u);
  assert.match(event.description, /late April/u);
  assert.match(event.description, /45 days/u);
  assert.doesNotMatch(event.description, /clarify territorial boundaries|determine.*boundary/iu);
});

test("Thai and Khmer fence copy preserves the supported numbers and scripts", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /24/u);
    assert.match(text, /1,310/u);
    assert.match(text, /45/u);
    assert.doesNotMatch(text, /\?{3,}|�/u);
  }
  assert.match(event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.descriptionKh, /[\u1780-\u17FF]/u);
});