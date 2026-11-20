import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7843df9nf7ms26ajfaxhdeh981w14z";
const mergedId = "ks7cy602ywxmvceykh698ajyws81pe1q";
const cambodiaDirectId = "jn7dwqb0axp938ewve6ahsvea181wwbw";
const cambodiaCapturedId = "5fd41da5f123e0712ae26df9acc4bbb0";
const cambodiaSecondaryId = "k97a8jzq94hgye7ycep5dyb0zn81q994";
const thaiBlockedId = "js76wtc5e3j9p1g9jn8gfxk4ds81wr8c";
const thaiCapturedId = "c61c4432047e267706abf15040d8e526";

test("Feb 22 maritime seizure duplicate is merged into one disputed-location event", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
  assert.equal(event.date, "2026-02-22");
  assert.equal(event.timeOfDay, "09:30");
  assert.match(event.title, /Cambodia Protests Maritime Seizure/u);
  assert.deepEqual(event.evidenceIds, [
    cambodiaDirectId,
    cambodiaCapturedId,
    thaiBlockedId,
    thaiCapturedId,
  ]);
});

test("survivor keeps both sides' location claims attributed and does not resolve sovereignty", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /Navy said.*09:30/u);
  assert.match(event.description, /two nautical miles inside Thai waters/u);
  assert.match(event.description, /Cambodia's Foreign Ministry said/u);
  assert.match(event.description, /7\.2 nautical miles from Koh Yor/u);
  assert.match(event.description, /without resolving the maritime boundary/u);
  assert.doesNotMatch(event.description, /unauthorized violation of sovereignty/u);
});

test("Thai and Khmer copy preserve actors, numbers and the competing-claims framing", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /3/u);
    assert.match(event[field], /09:30/u);
    assert.match(event[field], /11°32\.63/u);
    assert.match(event[field], /102°50\.54/u);
    assert.match(event[field], /7\.2/u);
    assert.match(event[field], /Koh Yor/u);
  }
});

test("repeated Cambodian and Thai official statements share provenance by source chain", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const byId = (id) => articles.find((row) => row.id === id);
  assert.equal(byId(cambodiaDirectId)?.provenanceId, "cambodia-mfa-feb22-maritime-protest");
  assert.equal(byId(cambodiaCapturedId)?.provenanceId, "cambodia-mfa-feb22-maritime-protest");
  assert.equal(byId(cambodiaSecondaryId)?.provenanceId, "cambodia-mfa-feb22-maritime-protest");
  assert.equal(byId(thaiBlockedId)?.provenanceId, "thai-navy-feb23-cambodian-fishing-boat-response");
  assert.equal(byId(thaiCapturedId)?.provenanceId, "thai-navy-feb23-cambodian-fishing-boat-response");
  assert.equal(byId(cambodiaCapturedId)?.status, "archived");
  assert.equal(byId(thaiCapturedId)?.status, "archived");
});
