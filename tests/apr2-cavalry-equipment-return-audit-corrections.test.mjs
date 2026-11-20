import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7axpwr3bndyd9rs15a24q249847ebf";
const oldEvidenceId = "jn33798bfc8dee49ed49c288e4f0f03d";
const officialEvidenceId = "824e132c35a48cef6c483774797ad001";

test("22nd Cavalry equipment return is anchored to April 2 at 11:20", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-02");
  assert.equal(event.timeOfDay, "11:20");
  assert.match(event.title, /Equipment Returning from Border Mission/u);
  assert.deepEqual(event.evidenceIds, [officialEvidenceId]);
});

test("timeline copy limits the claim to one unit's equipment return", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /22nd Cavalry Battalion/u);
  assert.match(event.description, /return of one unit's equipment/u);
  assert.match(event.description, /not a general withdrawal of Thai heavy armor/u);
  assert.doesNotMatch(event.description, /began withdrawing from the Cambodia border/u);
  assert.match(event.descriptionTh, /ไม่ใช่หลักฐานว่ากองทัพไทยถอนรถถังหรืออาวุธหนักทั้งหมด/u);
  assert.match(event.descriptionKh, /មិនមែនជាភស្តុតាងថាកងទ័ពថៃបានដករថក្រោះ/u);
});

test("official Cavalry Center evidence replaces the generic Thairath tag page", () => {
  const articles = readJsonl("data/news/2026-04.jsonl");
  const official = articles.find((row) => row.id === officialEvidenceId);
  const old = articles.find((row) => row.id === oldEvidenceId);
  assert.ok(official);
  assert.ok(old);
  assert.equal(official.credibility, 100);
  assert.equal(official.provenanceId, "thai-cavalry-center-apr2-equipment-return");
  assert.match(official.summary, /11:20 on April 2, 2026/u);
  assert.equal(old.status, "archived");
  assert.match(old.summary, /topic index rather than the underlying report/u);
});
