import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7deqw2dhcc83h8jdtm3sk4yn812jtj";
const oldSourceId = "js7fv8kzpp5z4mrsvz1ffzp8kd7y1j59";
const thairathId = "f895163822d10aa479813e68ac9ea34c";
const pptvId = "0802e340bed24da94c7bebc935739c70";
const provenanceId = "thai-first-army-region-ban-khlong-phaeng-dec25-2025";

test("December 25 Ban Khlong Phaeng strike is date-only and tied to the morning report", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Thai 1st Army Region Says 40 BM-21 Rockets/u);
  assert.match(event.description, /during the morning/u);
  assert.doesNotMatch(event.description, /15:00/u);
});

test("strike damage is separated from the four-district shelter total", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /three homes damaged and no injuries/u);
  assert.match(event.description, /17,913 people from four Sa Kaeo border districts/u);
  assert.match(event.description, /not presented as displacement caused by this single strike/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุว่าเกิดจากการโจมตีครั้งเดียวนี้โดยตรง/u);
  assert.match(event.descriptionKh, /មិនត្រូវបានបង្ហាញថាបណ្តាលមកពីការវាយប្រហារតែមួយនេះទេ/u);
});

test("responsibility claims remain attributed to the Thai side in all languages", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /remain attributed to the Thai side/u);
  assert.match(event.descriptionTh, /ยังเป็นคำกล่าวของฝ่ายไทย/u);
  assert.match(event.descriptionKh, /ជាការអះអាងរបស់ភាគីថៃ/u);
  assert.deepEqual(event.evidenceIds, [thairathId, pptvId]);
});

test("all reports derived from the 1st Army Region summary share one provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  for (const id of [oldSourceId, thairathId, pptvId]) {
    const article = articles.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId, id);
  }
});
