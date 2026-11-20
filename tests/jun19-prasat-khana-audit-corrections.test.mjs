import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks71xtc4jqyqx9kapcx379xew988zka6";

test("Prasat Khana row removes unsupported 08:00", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-19");
  assert.equal(event.timeOfDay, undefined);
});

test("territorial and control claims stay attributed to the Thai Army", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Thai Army spokesperson Maj Gen Winthai Suvaree/u);
  assert.match(event.description, /Thai Army's account/u);
  assert.match(event.description, /not independently established/u);
  assert.match(event.description, /90%/u);
});

test("Thai and Khmer copies preserve attribution and no exact event time", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("90"));
    assert.ok(!value.includes("08:00"));
  }
  assert.match(event.descriptionTh, /เป็นคำกล่าวของกองทัพไทย/u);
  assert.match(event.descriptionKh, /ជាការរៀបរាប់របស់កងទ័ពថៃ/u);
});
