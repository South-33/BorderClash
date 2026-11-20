import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks74h5ejkxhy6zg42frm401xd189bmn5";
const evidenceId = "js76v8wrd9ry1cg9ryx17aahs589afpv";

test("June 25 Suranaree restructuring removes unsupported 09:00", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-25");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Suranaree restructuring keeps the captured Task Force 4 scope", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Task Force 4/u);
  assert.match(event.description, /Ubon Ratchathani/u);
  assert.match(event.descriptionTh, /เฉพาะกิจ 4/u);
  assert.match(event.descriptionKh, /Task Force 4/u);
});
