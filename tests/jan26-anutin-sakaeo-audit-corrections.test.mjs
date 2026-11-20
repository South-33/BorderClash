import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7aqwxpgq01zxp45nyqw51smn813pbg";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Jan 26 Anutin visit uses captured 15:30 time and correct recipient breakdown", () => {
  assert.equal(event.date, "2026-01-26");
  assert.equal(event.timeOfDay, "15:30");
  assert.deepEqual(event.evidenceIds, ["js70v9dk4s20jxft0mzzc41d1s7zzzjc"]);
  assert.match(event.description, /one person with a permanent disability and four people with serious injuries/u);
  assert.match(event.description, /Ban Khlong Phaeng visit at 15:30/u);
  assert.doesNotMatch(event.description, /five civilians permanently disabled/u);
  assert.match(event.descriptionTh, /ทุพพลภาพ 1 ราย/u);
  assert.match(event.descriptionTh, /บาดเจ็บสาหัส 4 ราย/u);
  assert.match(event.descriptionKh, /5 នាក់/u);
  assert.match(event.descriptionKh, /4 នាក់រងរបួសធ្ងន់/u);
});
