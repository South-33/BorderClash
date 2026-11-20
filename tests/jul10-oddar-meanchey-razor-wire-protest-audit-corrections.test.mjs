import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7d3335bev11yygjdnz3edbp58b5872";
const evidenceId = "k977266wd2b7nrh2ckvkkdxpn18aaszn";

test("Oddar Meanchey protest is dated to the July 10 diplomatic protest, not the July 9 alleged incident", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-10");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Cambodia Protests Alleged Thai/u);
  assert.match(event.description, /July 10 press release/u);
  assert.match(event.description, /between July 5 and 7/u);
  assert.match(event.description, /Boundary Pillar No\. 22 on July 9/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("all language versions keep the territorial claims attributed", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /ministry alleged/u);
  assert.match(event.description, /did not independently establish the territorial claims/u);
  assert.match(event.descriptionTh, /กระทรวงฯ กล่าวหา/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันข้ออ้างเรื่องดินแดน/u);
  assert.match(event.descriptionKh, /ក្រសួងបានចោទ/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ដោយឯករាជ្យ/u);
});
