import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks744dgksp876mc4nvdyh2jq4d8448xw";
const evidenceId = "k9758xdj9yn3j131b2ycah9fbh844db5";

test("March 31 corvette milestone records the Thai Navy assessment, not a new procurement decision", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-31");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Thai Navy Says Planned Cambodian Type 056 Corvettes Pose No Threat/u);
  assert.match(event.description, /Rear Admiral Parach Rattanachaiyaphan/u);
  assert.match(event.description, /expected to receive two Chinese-made Type 056 corvettes/u);
  assert.match(event.description, /did not announce a new Cambodian procurement decision/u);
  assert.doesNotMatch(event.description, /significant upgrade.*2025 conflict/iu);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Thai and Khmer copy preserve the two-vessel count and Thai attribution", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh, /กองทัพเรือไทย/u);
  assert.match(event.descriptionTh, /2 ลำ/u);
  assert.match(event.descriptionTh, /ไม่ใช่การประกาศการจัดหาใหม่/u);
  assert.match(event.titleKh, /កងទ័ពជើងទឹកថៃ/u);
  assert.match(event.descriptionKh, /ចំនួន 2 គ្រឿង/u);
  assert.match(event.descriptionKh, /មិនមែនជាការប្រកាសសម្រេចទិញថ្មី/u);
});
