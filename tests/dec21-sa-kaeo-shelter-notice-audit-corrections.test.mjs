import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7fzgqmd79a1vc9w5afw8mrs181223b";
const naewnaId = "009f3c06e92cc36383faac63c9602743";
const khaoHunId = "js7b8y5nbmt6mdnva7xdt09x4x7xpt61";
const provenanceId = "first-army-sa-kaeo-shelter-notice-2025-12-21";

test("Dec 21 Sa Kaeo record uses the sourced 15:30 First Army shelter notice", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-21");
  assert.equal(event.timeOfDay, "15:30");
  assert.deepEqual(event.evidenceIds, [naewnaId, khaoHunId]);
  assert.match(event.title, /Stay Out and Use Shelters/u);
  assert.match(event.description, /Burapha Force operations against Cambodian military targets/u);
  assert.match(event.description, /did not say the instruction was triggered by a new BM-21 strike/u);
  assert.doesNotMatch(event.title, /Mass Evacuation/u);
});

test("Thai and Khmer copy preserve the notice reason without inventing a new rocket trigger", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /เวลา 15:30 น\. วันที่ 21 ธันวาคม/u);
  assert.match(event.descriptionTh, /กองกำลังบูรพากำลังปฏิบัติการต่อที่หมายทางทหาร/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุว่าคำสั่งนี้เกิดจากการโจมตี BM-21 ครั้งใหม่/u);
  assert.match(event.descriptionKh, /15:30 ថ្ងៃទី 21 ខែធ្នូ/u);
  assert.match(event.descriptionKh, /កងកម្លាំង Burapha កំពុងប្រតិបត្តិការយោធា/u);
  assert.match(event.descriptionKh, /ការវាយប្រហារ BM-21 ថ្មី/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("focused Dec 21 reports share the First Army notice provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const naewna = articles.find((row) => row.id === naewnaId);
  const khaoHun = articles.find((row) => row.id === khaoHunId);
  assert.ok(naewna);
  assert.ok(khaoHun);
  assert.equal(naewna.provenanceId, provenanceId);
  assert.equal(khaoHun.provenanceId, provenanceId);
  assert.match(naewna.summary, /at 15:30 on December 21/u);
  assert.match(khaoHun.summary, /notice itself cited the Thai operations/u);
});
