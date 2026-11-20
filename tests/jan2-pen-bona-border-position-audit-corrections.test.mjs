import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73m01z1vpqpqfx1canrxwcfs8134xz";
const evidenceId = "js70fk3h6b1b9tkgezf1aa49gn7ye006";

test("Jan 2 Pen Bona position is date-only and tied to the soldier release", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-02");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.description, /release of 18 Cambodian soldiers/u);
  assert.match(event.description, /December 27 GBC joint statement/u);
});

test("unsupported original-maps requirement is removed from the claim", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /technical mechanisms and international law/u);
  assert.match(event.description, /would not accept boundary changes resulting from the use of force/u);
  assert.match(event.description, /does not say disputes must be settled using 'original maps'/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("Thai and Khmer versions preserve the same unsupported-map caveat", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /18 นาย/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุว่าข้อพิพาทต้องแก้โดยใช้/u);
  assert.match(event.descriptionKh, /18 នាក់/u);
  assert.match(event.descriptionKh, /មិនបាននិយាយថា វិវាទត្រូវដោះស្រាយដោយប្រើ/u);
});

test("captured evidence summary matches the Thai PBS report", () => {
  const article = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.provenanceId, "cambodia-gov-pen-bona-border-position-2026-01-02");
  assert.match(article.summary, /release of 18 Cambodian soldiers/u);
  assert.match(article.summary, /does not mention an 'original maps' requirement/u);
});
