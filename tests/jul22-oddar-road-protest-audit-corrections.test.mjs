import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const protestId = "ks75jhehjmpzwygtfwam5k8p2d8bh0ws";
const activityId = "ks71bmpmwqg0bfqg88wkg8d3a18b5t0p";
const akpId = "jn71njkrqby1zhx017d92cjxjn8bg6ym";
const khmerTimesId = "jn7c3ehz1jc32jmxez3hpwkbtd8b4s6c";
const provenanceId = "cambodia-mfa-jul22-oddar-engineering-protest";

test("July 22 diplomatic protest is date-only and remains distinct from the July 13-19 activity", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  const protest = timeline.find((row) => row.id === protestId);
  const activity = timeline.find((row) => row.id === activityId);
  assert.ok(protest);
  assert.ok(activity);
  assert.equal(protest.date, "2026-07-22");
  assert.equal(protest.timeOfDay ?? "", "");
  assert.equal(activity.date, "2026-07-19");
  assert.doesNotMatch(protest.description, /15:00/u);
});

test("territorial and legal claims remain attributed to Cambodia", () => {
  const protest = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === protestId);
  assert.ok(protest);
  assert.match(protest.title, /Cambodia Protests Reported Thai Road/u);
  assert.match(protest.description, /Cambodia's Foreign Ministry formally protested/u);
  assert.match(protest.description, /Cambodia alleged/u);
  assert.match(protest.description, /These territorial and legal claims are Cambodia's position/u);
  assert.match(protest.description, /does not include Thailand's response/u);
});

test("Thai and Khmer copy preserve attribution", () => {
  const protest = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === protestId);
  assert.ok(protest);
  assert.match(protest.descriptionTh, /กัมพูชากล่าวหา/u);
  assert.match(protest.descriptionTh, /เป็นจุดยืนของกัมพูชา/u);
  assert.match(protest.descriptionKh, /កម្ពុជាបានអះអាង/u);
  assert.match(protest.descriptionKh, /ជាជំហររបស់កម្ពុជា/u);
});

test("AKP and Khmer Times share the underlying Cambodian MFA statement provenance", () => {
  const articles = readJsonl("data/news/2026-07.jsonl");
  const akp = articles.find((row) => row.id === akpId);
  const khmerTimes = articles.find((row) => row.id === khmerTimesId);
  assert.ok(akp);
  assert.ok(khmerTimes);
  assert.equal(akp.provenanceId, provenanceId);
  assert.equal(khmerTimes.provenanceId, provenanceId);
  assert.match(akp.summary, /Cambodia's July 22 Foreign Ministry protest/u);
  assert.match(akp.summary, /does not include a Thai response/u);
});
