import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("February 3 ceremony preserves the supported 09:00 time and spans both 2025 fighting periods", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl")
    .find((row) => row.id === "ks71v8xkckvz7xaezgtb3pj90x812q3r");
  assert.ok(event);
  assert.equal(event.date, "2026-02-03");
  assert.equal(event.timeOfDay, "09:00");
  assert.match(event.description, /July 24-28 and December 7-27, 2025/u);
  assert.doesNotMatch(event.description, /late 2025|first consolidated official death toll/iu);
  assert.deepEqual(event.evidenceIds.slice(0, 2), [
    "99464caa4534d83defd89d866fb42659",
    "b867cacde13888e01a94d62f698a95ab",
  ]);
});

test("new evidence directly supports ceremony time and the two casualty periods", () => {
  const feb = readJsonl("data/news/2026-02.jsonl")
    .find((row) => row.id === "99464caa4534d83defd89d866fb42659");
  const jan = readJsonl("data/news/2026-01.jsonl")
    .find((row) => row.id === "b867cacde13888e01a94d62f698a95ab");
  assert.ok(feb);
  assert.ok(jan);
  assert.match(feb.summary, /09:00 on February 3, 2026/u);
  assert.match(jan.summary, /July 24-28 and December 7-27, 2025/u);
  assert.equal(new Date(jan.publishedAt).toISOString(), "2026-01-15T05:42:00.000Z");
  assert.equal(jan.provenanceId, "thai-army-42-fallen-ranks-jan15");
});
