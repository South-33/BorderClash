import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks78w5s8dzdawhzycna85z7rys812ywv";
const akpId = "d88b5b5efaf268fcfb621ebbbe760b1d";
const vgpId = "b94581855063cfc917af149e01bee4d0";

test("February 6 milestone records the actual trilateral party summit without invented time", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-06");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.title, "Cambodia, Vietnam and Laos Hold Trilateral Party Summit");
  assert.deepEqual(event.evidenceIds, [akpId, vgpId]);
  assert.match(event.description, /afternoon of February 6/u);
  assert.match(event.description, /Hun Sen/u);
  assert.match(event.description, /To Lam/u);
  assert.match(event.description, /Thongloun Sisoulith/u);
});

test("event copy reflects documented agenda rather than preview speculation about Thailand", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /defence, border security and peace/u);
  assert.match(event.description, /trade and economic development/u);
  assert.match(event.description, /culture/u);
  assert.doesNotMatch(event.description, /strategic move/u);
  assert.doesNotMatch(event.description, /standoff with Thailand/u);
  assert.doesNotMatch(event.title, /Security Summit/u);
});

test("Thai and Khmer copy preserve leaders, afternoon timing, and broad agenda", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /ช่วงบ่ายวันที่ 6 กุมภาพันธ์/u);
  assert.match(event.descriptionTh, /ฮุน เซน/u);
  assert.match(event.descriptionTh, /โต เลิม/u);
  assert.match(event.descriptionKh, /នៅរសៀលថ្ងៃទី 6 ខែកុម្ភៈ/u);
  assert.match(event.descriptionKh, /ហ៊ុន សែន/u);
  assert.match(event.descriptionKh, /To Lam/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("Cambodian and Vietnamese official reports remain independent evidence records", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const akp = articles.find((row) => row.id === akpId);
  const vgp = articles.find((row) => row.id === vgpId);
  assert.ok(akp);
  assert.ok(vgp);
  assert.equal(akp.credibility, 90);
  assert.equal(vgp.credibility, 90);
  assert.equal(akp.provenanceId, undefined);
  assert.equal(vgp.provenanceId, undefined);
  assert.match(akp.summary, /afternoon trilateral summit/u);
  assert.match(vgp.summary, /co-chaired a meeting of the three ruling parties/u);
});
