import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7fwjw7zw2t2xqz7k5krdhwhs8bg8bk";
const duplicateId = "ks70kdemh9gsg7w8ww1yy2hskd8b8rt3";
const capturedThairathId = "875057b33fe6218825d2266bd878e4f6";
const capturedBangkokPostId = "82c13626595792018507c8475e287870";
const provenanceId = "thai-defense-dong-jun-adul-2026-07-24";

test("July 24 Dong Jun duplicate rows collapse into one date-only event", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-24");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.deepEqual(event.evidenceIds, [capturedThairathId, capturedBangkokPostId]);
});

test("neutrality and supply-policy claims remain attributed to Adul", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.title, /Thai Defence Minister Says China Reaffirmed Neutrality/u);
  assert.match(event.description, /Adul said Dong had reaffirmed China's neutral position/u);
  assert.match(event.description, /attributed to Adul's account/u);
  assert.match(event.description, /do not independently establish China's internal policy decisions/u);
  assert.doesNotMatch(event.description, /14:00/u);
});

test("Thai and Khmer copy preserve the same attribution and uncertainty", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.descriptionTh, /พล\.ท\.อดุลย์กล่าวว่า/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันนโยบายภายในของจีนอย่างอิสระ/u);
  assert.match(event.descriptionKh, /Adul បាននិយាយថា/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ដោយឯករាជ្យ/u);
});

test("all July 24 neutrality reports share one underlying statement provenance", () => {
  const articles = readJsonl("data/news/2026-07.jsonl");
  const ids = [
    "js7e2ft35mqmskm93dqfrb4p918bhqf9",
    "js7bdt56yezbm0x1r2pgastmds8b9nmm",
    capturedThairathId,
    capturedBangkokPostId,
  ];
  for (const id of ids) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId, id);
  }
});
