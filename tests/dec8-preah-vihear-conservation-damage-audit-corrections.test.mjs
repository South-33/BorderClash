import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const dec8Id = "ks7dkxtg2cksw57jv3ez4fay75813hge";
const dec12Id = "ks705a729kegk6vkm4zvdkx60n812adt";
const freshNewsId = "jn71928v1se0y322nz0rakgmed7xemjz";
const akpId = "c8bc3ed04baf3a4b8fb039648d52083b";
const hinduId = "k97528zb13b1nwnsds1vp8tkx97x7p2d";

test("December 8 conservation damage is date-only and uses the captured morning-level precision", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === dec8Id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-08");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Cambodian Culture Ministry Reports Damage/u);
  assert.match(event.description, /morning of December 8/u);
  assert.doesNotMatch(event.description, /05:00|07:00/u);
  assert.match(event.description, /Cambodia's allegation/u);
  assert.match(event.description, /not an independent finding/u);
  assert.doesNotMatch(event.description, /cable car|aviation restrictions/u);
  assert.deepEqual(event.evidenceIds, [freshNewsId, akpId, hinduId]);
});

test("December 12 row records India's diplomatic response rather than unsupported damage details", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === dec12Id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-12");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /India Expresses Concern/u);
  assert.match(event.description, /Ministry of External Affairs/u);
  assert.match(event.description, /did not assign responsibility/u);
  assert.doesNotMatch(event.description, /AFP|560|shrapnel|broken sandstone/u);
  assert.deepEqual(event.evidenceIds, [hinduId]);
});

test("English, Thai and Khmer preserve morning-level precision and the attribution boundary", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === dec8Id);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.doesNotMatch(event[field], /05:00|07:00/u);
  }
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /មិនមែនជាការសន្និដ្ឋានឯករាជ្យ/u);
});

test("evidence registry reflects the displayed Fresh News time and India's neutral attribution", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const freshNews = articles.find((row) => row.id === freshNewsId);
  const akp = articles.find((row) => row.id === akpId);
  const hindu = articles.find((row) => row.id === hinduId);
  assert.ok(freshNews);
  assert.ok(akp);
  assert.ok(hindu);
  assert.equal(freshNews.publishedAt, Date.parse("2025-12-08T08:33:16Z"));
  assert.equal(freshNews.provenanceId, "cambodia-culture-dec8-preah-vihear-damage-statement");
  assert.equal(akp.provenanceId, "cambodia-culture-dec8-preah-vihear-damage-statement");
  assert.match(freshNews.summary, /between 05:00 and 07:00/u);
  assert.match(freshNews.summary, /not independent responsibility/u);
  assert.equal(hindu.credibility, 80);
  assert.match(hindu.summary, /did not assign responsibility/u);
});
