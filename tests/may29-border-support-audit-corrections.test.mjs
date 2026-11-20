import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks773qnfja0k93qtwtwp1cy2h187q05f";
const evidenceId = "js73mwydjjcqr5y65q0n6926p987p36b";
const exactTimeEvidenceId = "99c91f9268ddd8734df9eb017fa645c7";
const provenanceId = "isoc-border-support-2026-05-29-1030";

test("border support milestone follows the captured May 29 10:30 convoy", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-29");
  assert.equal(event.timeOfDay, "10:30");
  assert.deepEqual(event.evidenceIds, [exactTimeEvidenceId, evidenceId]);
});

test("shipment contents match captured FM91 reporting", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  for (const value of ["10:30", "50", "1.8", "3", "4,500", "6,000"]) {
    assert.ok(event.description.includes(value), value);
  }
  assert.match(event.description, /second support convoy/u);
  assert.match(event.description, /2nd Area provided personnel and transport vehicles/u);
  assert.doesNotMatch(event.description, /advanced anti-drone equipment/u);
});

test("Thai and Khmer copies preserve shipment quantities and uncertainty boundary", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  for (const value of ["10:30", "29", "50", "1.8", "3", "4,500", "6,000", "2"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ไม่ได้ยืนยัน/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់/u);
});

test("FM91 article identity and publication timestamp match the captured publisher page", () => {
  const article = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "FM91 BKK");
  assert.match(article.title, /กอ\.รมน/u);
  assert.match(article.titleEn, /Bunkers and Anti-Drone Nets/u);
  assert.equal(article.publishedAt, Date.parse("2026-05-30T15:42:00Z"));
  assert.equal(article.provenanceId, provenanceId);
  assert.match(article.summary, /on May 29/u);
  assert.match(article.summary, /4,500 kilograms/u);
});

test("captured June mirror directly supports the exact event time and shares provenance", () => {
  const article = readJsonl("data/news/2026-06.jsonl").find((row) => row.id === exactTimeEvidenceId);
  assert.ok(article);
  assert.equal(article.provenanceId, provenanceId);
  assert.match(article.summary, /May 29, 2026 at 10:30/u);
  assert.match(article.summary, /50 concrete bunker units/u);
  assert.match(article.summary, /4,500 kilograms/u);
  assert.match(article.summary, /6,000 sandbags/u);
});
