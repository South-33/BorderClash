import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks75xdsqcasrgvzver3x68ns4983r677";
const evidenceId = "3d6d3bac51a33332def43fce0df995bd";

test("March 26 Trat row removes unsupported 10:00 and uses captured Siam Rath evidence", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-26");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("gunfire and ceasefire breach remain attributed to the Thai marine commander", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Capt Thammanoon Wanna/u);
  assert.match(event.description, /three bursts of rifle fire/u);
  assert.match(event.description, /he characterized this as a breach/u);
  assert.match(event.description, /Thai military allegations/u);
  assert.match(event.description, /does not independently establish who fired the shots/u);
});

test("row removes blanket Thmor Da control claim and preserves source distinction", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /casino building.*under Thai control/u);
  assert.match(event.description, /wider nearby area.*outside Thai control/u);
  assert.match(event.description, /does not establish Thai control of the wider Thmor Da border area/u);
  assert.match(event.description, /no exact time/u);
});

test("Thai and Khmer copies preserve attribution and control uncertainty", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.match(event.descriptionTh, /ข้อกล่าวหาของฝ่ายทหารไทย/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระว่าใครเป็นผู้ยิง/u);
  assert.match(event.descriptionTh, /อยู่นอกการควบคุมของไทย/u);
  assert.match(event.descriptionKh, /ការចោទប្រកាន់របស់យោធាថៃ/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ដោយឯករាជ្យថាអ្នកណាបាញ់/u);
  assert.match(event.descriptionKh, /ស្ថិតក្រៅការគ្រប់គ្រងរបស់ថៃ/u);
});
