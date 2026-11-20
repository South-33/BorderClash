import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7709mpvd1pc3a4pfdyw8n8fd8123yr";
const oldThaiPbsId = "js76tnv5qw5zqwvsdks7qkyq0d80p6z3";
const noticeMirrorId = "629b8ae171ef242ea4d2d5275525f297";
const provenanceId = "caat-drone-notice-15-2026-02-06";

test("CAAT Notice No. 15 is a Feb 6 date-only relaxation milestone", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-06");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Relaxes Drone Controls/u);
  assert.match(event.description, /Effective February 6/u);
  assert.match(event.description, /relaxed earlier civilian-drone controls/u);
});

test("the seven border provinces are correct and do not include Chiang Rai", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const province of [
    "Ubon Ratchathani", "Si Sa Ket", "Surin", "Buriram", "Sa Kaeo", "Chanthaburi", "Trat",
  ]) {
    assert.match(event.description, new RegExp(province, "u"));
  }
  assert.doesNotMatch(event.description, /Chiang Rai/u);
});

test("00:01 is retained only as a daily no-flight restriction", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /00:01–04:00/u);
  assert.match(event.description, /not the notice's effective time/u);
  assert.match(event.descriptionTh, /ไม่ใช่เวลาเริ่มมีผล/u);
  assert.match(event.descriptionKh, /មិនមែនជាពេលចាប់ផ្តើមមានប្រសិទ្ធភាព/u);
});

test("timeline uses the captured notice mirror and preserves Thai PBS date discrepancy", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === eventId);
  assert.deepEqual(event.evidenceIds, [noticeMirrorId]);

  const articles = readJsonl("data/news/2026-02.jsonl");
  const thaiPbs = articles.find((row) => row.id === oldThaiPbsId);
  const mirror = articles.find((row) => row.id === noticeMirrorId);
  assert.ok(thaiPbs);
  assert.ok(mirror);
  assert.equal(thaiPbs.provenanceId, provenanceId);
  assert.equal(mirror.provenanceId, provenanceId);
  assert.match(thaiPbs.summary, /differs from the signed CAAT notice/u);
  assert.match(mirror.summary, /effective from February 6, 2026/u);
});
