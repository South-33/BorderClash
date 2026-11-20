import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7afwtgnvgq31feqdhzz692xh89bwh9";
const evidenceId = "jn79a88e0m162p4edfv1e96dtd89a5pf";

test("Ta Moan AOT visit removes unsupported 11:00 exact time", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-25");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Ta Moan AOT visit remains attributed to the Cambodian Defence Ministry", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.title, /Cambodian Defence Ministry Says/u);
  assert.match(event.description, /citing Cambodia's Ministry of National Defence/u);
  assert.match(event.description, /took place that morning/u);
  assert.match(event.description, /does not give an exact start time/u);
});

test("Thai and Khmer copies preserve attribution and no exact start time", () => {
  const event = read("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.titleTh, /กลาโหมกัมพูชาระบุ/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุเวลาเริ่มภารกิจที่แน่นอน/u);
  assert.match(event.titleKh, /ក្រសួងការពារជាតិកម្ពុជាថា/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ម៉ោងចាប់ផ្តើមជាក់លាក់ទេ/u);
});

test("stored evidence summary distinguishes CLG facilitation from the AOT mission", () => {
  const article = read("data/news/2026-06.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.doesNotMatch(article.summary, /Cambodian military conducted a review/u);
  assert.match(article.summary, /Liaison Group facilitated an ASEAN Observer Team field mission/u);
  assert.match(article.summary, /Citing the Ministry of National Defence/u);
});
