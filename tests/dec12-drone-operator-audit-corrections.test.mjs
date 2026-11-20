import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73kssjcqrw7ky4pbjg0rx8v1813hc2";
const originalId = "js72mfgj1vk81qfdzfsayx315x7x8qt4";
const capturedId = "cdb545136bfccac5b8cc984b2e6f09e8";
const blockedTrialId = "564264b356e87e743524c3e0ba738da8";
const provenanceId = "thai-second-army-drone-operator-assessment-2025-12-12";

test("drone assessment is date-only, unverified and cites captured Thai Rath evidence", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-12");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [capturedId]);
});

test("foreign-operator assessment does not invent Russian advisers", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Thai military assessments/u);
  assert.match(event.description, /does not independently establish/u);
  assert.match(event.description, /does not specifically identify Russian advisers/u);
  assert.doesNotMatch(event.title, /Russian/u);
});

test("Thai and Khmer copies preserve the attribution and nationality uncertainty", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.descriptionTh, /การประเมินของฝ่ายทหารไทย/u);
  assert.match(event.descriptionKh, /ការវាយតម្លៃរបស់យោធាថៃ/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /មិនបានផ្ទៀងផ្ទាត់ដោយឯករាជ្យ/u);
});

test("parallel publisher rows share provenance and blocked trial row is discarded", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const original = news.find((row) => row.id === originalId);
  const captured = news.find((row) => row.id === capturedId);
  assert.ok(original);
  assert.ok(captured);
  assert.equal(original.provenanceId, provenanceId);
  assert.equal(captured.provenanceId, provenanceId);
  assert.equal(news.some((row) => row.id === blockedTrialId), false);
});
