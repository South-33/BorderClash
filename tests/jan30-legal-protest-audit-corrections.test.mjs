import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks77k7y010r8b5w4g8gr16gggx812m8k";
const evidenceId = "jn72q3jxkv4sry4t7ft13m1vj9806fhz";

test("Jan 30 protest is date-only and stays tied to captured Khmer Times evidence", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-30");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("legal and ceasefire conclusions remain attributed to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Cambodian ministry said/u);
  assert.match(event.description, /ASEAN Charter/u);
  assert.match(event.description, /Treaty of Amity and Cooperation/u);
  assert.match(event.description, /These are Cambodia's legal and diplomatic positions/u);
  assert.match(event.description, /does not independently establish/u);
  assert.doesNotMatch(event.description, /Cambodia labeled the move a violation of international immunity/u);
});

test("Thai and Khmer copies preserve actors, date, and attribution", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  for (const value of ["30", "27"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /กระทรวงกัมพูชาระบุ/u);
  assert.match(event.descriptionKh, /ក្រសួងកម្ពុជាបាននិយាយ/u);
  assert.match(event.descriptionTh, /ฮุน มาเนต/u);
  assert.match(event.descriptionKh, /ហ៊ុន ម៉ាណែត/u);
});

test("article summary distinguishes reportable protest from legal conclusions", () => {
  const article = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /lodged a formal protest/u);
  assert.match(article.summary, /reportedly filed a police complaint/u);
  assert.match(article.summary, /Cambodia's stated position/u);
  assert.match(article.summary, /not independently established findings/u);
});
