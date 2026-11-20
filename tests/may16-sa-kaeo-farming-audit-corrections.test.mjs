import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const survivorId = "ks71vj0ws7t6h3fvyw06tq0fan87501b";
const duplicateId = "ks76ct96z4yghczyzte3jxebt186ywh8";
const evidenceId = "k972vmn50tavz7ymkgg925rrm186yd1q";

test("Sa Kaeo farming duplicate is merged under the May 16 incident date", () => {
  const rows = read("data/timeline/2026-05.jsonl");
  const event = rows.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(rows.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-05-16");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Thai territorial claims stay attributed and report receipt time is not event time", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === survivorId);
  assert.match(event.description, /territory Thailand regards as sovereign/u);
  assert.match(event.description, /Thai side's claim/u);
  assert.match(event.description, /received the report at 10:00/u);
  assert.match(event.description, /does not establish 10:00 as the time/u);
});

test("Thai and Khmer copies preserve attribution and exact-time uncertainty", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === survivorId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("10:00"));
    assert.ok(value.includes("GPS"));
  }
  assert.match(event.descriptionTh, /ข้ออ้างด้านเขตแดนของฝ่ายไทย/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់ភាគីថៃ/u);
});
