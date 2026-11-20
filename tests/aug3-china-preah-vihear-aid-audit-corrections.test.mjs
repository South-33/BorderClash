import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7fazv58316p74jb29spx1pad8c4xct";
const evidenceId = "jn70t75ktmc5dcgf3yxeq2zs4s8bwfzz";

test("August 3 Chinese Ambassador aid visit removes unsupported 10:00", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-08-03");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("aid description stays within the captured Khmer Times account", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Peung Angkam Pagoda/u);
  assert.match(event.description, /Chinese Embassy/u);
  assert.match(event.description, /sympathy and concern/u);
  assert.doesNotMatch(event.description, /confidence in its leadership/u);
  assert.match(event.description, /does not give an exact visit time/u);
});

test("Thai and Khmer copies remove unsupported open-ended aid promises", () => {
  const event = read("data/timeline/2026-08.jsonl").find((row) => row.id === eventId);
  assert.doesNotMatch(event.descriptionTh, /จนกว่าจะได้กลับบ้าน/u);
  assert.doesNotMatch(event.descriptionKh, /រហូតដល់ពួកគេបានត្រឡប់ទៅផ្ទះវិញ/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุเวลาที่แน่นอน/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ម៉ោងច្បាស់លាស់/u);
});
