import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks79rhsdc436esjpstx50pp7yh813n0y";
const thaigerId = "js77ewtmxw0nxp8p6e5a5k2cks801h68";
const naewnaId = "js78pce6hxmng6a0xmjq9k92fs7zym0h";
const blockedIds = ["js7etqg7gz2xmf1yv95f4bdbe97zz13b", "js78rh7sqhacv3jzyc5zr27st97zz4he"];
const provenanceId = "thai-naval-source-trat-trenches-drones-2026-01-26";

test("Jan 26 trench row is date-only and cites only captured publisher evidence", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-26");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [thaigerId, naewnaId]);
  for (const id of blockedIds) assert.equal(event.evidenceIds.includes(id), false);
});

test("trench geography is retained while the drone incursion remains attributed", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  for (const value of ["Ban Tha Sen", "Ban Nong Ri", "Ban Chamra", "more than 1 km", "about 500 m"]) {
    assert.ok(event.description.includes(value), value);
  }
  assert.match(event.description, /remained inside Cambodian territory/u);
  assert.match(event.description, /Thai naval source also alleged/u);
  assert.match(event.description, /do not independently verify the alleged drone incursion/u);
});

test("Thai and Khmer copies preserve distance, attribution and uncertainty", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  for (const value of ["1", "500", "26"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /กล่าวห/u);
  assert.match(event.descriptionKh, /ចោទ/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยัน/u);
  assert.match(event.descriptionKh, /មិនបានផ្ទៀងផ្ទាត់/u);
});

test("captured reports share one Thai naval-source provenance chain", () => {
  const news = readJsonl("data/news/2026-01.jsonl");
  for (const id of [thaigerId, naewnaId]) {
    const article = news.find((row) => row.id === id);
    assert.ok(article, id);
    assert.equal(article.provenanceId, provenanceId);
    assert.match(article.summary, /inside Cambodian territory/u);
    assert.match(article.summary, /does not independently verify/u);
  }
});
